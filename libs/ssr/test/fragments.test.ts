import { describe, expect, it, vi } from 'vitest';
import {
  renderFragmentsToString,
  renderFragmentsToReadableStream,
  type FragmentOutcome,
} from '../src/fragments.js';

const collect = async (stream: ReadableStream<Uint8Array>): Promise<string> => {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) out += dec.decode(value, { stream: true });
  }
  out += dec.decode();
  return out;
};

describe('renderFragmentsToString', () => {
  it('replaces a single placeholder with the rendered fragment', async () => {
    const shell = '<main><moxjs-fragment name="header" /></main>';
    const { html, outcomes } = await renderFragmentsToString({
      shell,
      fragments: [{ name: 'header', render: async () => '<h1>hi</h1>' }],
    });
    expect(html).toBe('<main><h1>hi</h1></main>');
    expect(outcomes[0]).toMatchObject({ name: 'header', phase: 'success' });
  });

  it('renders multiple fragments in parallel', async () => {
    const order: string[] = [];
    const make = (name: string, ms: number) => ({
      name,
      render: async () => { await new Promise((r) => setTimeout(r, ms)); order.push(name); return `<i>${name}</i>`; },
    });
    const shell = '<a><moxjs-fragment name="x"/></a><b><moxjs-fragment name="y"/></b>';
    const { html } = await renderFragmentsToString({
      shell,
      fragments: [make('x', 30), make('y', 5)],
    });
    expect(html).toBe('<a><i>x</i></a><b><i>y</i></b>');
    // `y` finishes first because shorter delay → parallel proof
    expect(order).toEqual(['y', 'x']);
  });

  it('uses fallback when fragment render throws', async () => {
    const shell = '<x><moxjs-fragment name="bad"/></x>';
    const { html, outcomes } = await renderFragmentsToString({
      shell,
      fragments: [{ name: 'bad', render: async () => { throw new Error('boom'); }, fallback: '<em>oops</em>' }],
    });
    expect(html).toBe('<x><em>oops</em></x>');
    expect(outcomes[0]!.phase).toBe('failed');
    if (outcomes[0]!.phase === 'failed') expect(outcomes[0]!.error.message).toBe('boom');
  });

  it('uses fallback when fragment times out', async () => {
    vi.useFakeTimers();
    try {
      const shell = '<x><moxjs-fragment name="slow"/></x>';
      const promise = renderFragmentsToString({
        shell,
        timeoutMs: 50,
        fragments: [{ name: 'slow', render: () => new Promise(() => {}), fallback: '<em>slow</em>' }],
      });
      vi.advanceTimersByTime(60);
      const { html, outcomes } = await promise;
      expect(html).toBe('<x><em>slow</em></x>');
      expect(outcomes[0]!.phase).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('empty fallback yields an empty replacement', async () => {
    const shell = '<x><moxjs-fragment name="bad"/></x>';
    const { html } = await renderFragmentsToString({
      shell,
      fragments: [{ name: 'bad', render: async () => { throw new Error('x'); } }],
    });
    expect(html).toBe('<x></x>');
  });

  it('emits onFragment for every outcome', async () => {
    const events: FragmentOutcome[] = [];
    await renderFragmentsToString({
      shell: '<moxjs-fragment name="a"/><moxjs-fragment name="b"/>',
      onFragment: (e) => events.push(e),
      fragments: [
        { name: 'a', render: async () => '<x/>' },
        { name: 'b', render: async () => { throw new Error('e'); }, fallback: '' },
      ],
    });
    expect(events.map((e) => `${e.name}:${e.phase}`).sort()).toEqual(['a:success', 'b:failed']);
  });

  it('passes the abort signal into the fragment', async () => {
    let captured!: AbortSignal;
    await renderFragmentsToString({
      shell: '<moxjs-fragment name="x"/>',
      fragments: [{ name: 'x', render: async (signal) => { captured = signal; return ''; } }],
    });
    expect(captured).toBeInstanceOf(AbortSignal);
  });

  it('honors per-fragment timeout overriding the parent timeout', async () => {
    vi.useFakeTimers();
    try {
      const promise = renderFragmentsToString({
        shell: '<moxjs-fragment name="x"/>',
        timeoutMs: 10_000,
        fragments: [{
          name: 'x',
          timeoutMs: 30,
          render: () => new Promise(() => {}),
          fallback: '<f/>',
        }],
      });
      vi.advanceTimersByTime(40);
      const { html, outcomes } = await promise;
      expect(html).toBe('<f/>');
      expect(outcomes[0]!.phase).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves unmatched placeholders blank (fragment not registered)', async () => {
    const { html } = await renderFragmentsToString({
      shell: '<a><moxjs-fragment name="missing"/></a>',
      fragments: [],
    });
    expect(html).toBe('<a></a>');
  });
});

describe('renderFragmentsToReadableStream', () => {
  it('flushes the shell with placeholders + a runtime script, then each fragment chunk', async () => {
    const shell = '<a><moxjs-fragment name="hi"/></a>';
    const { stream, done } = renderFragmentsToReadableStream({
      shell,
      fragments: [{ name: 'hi', render: async () => '<h1>HI</h1>' }],
    });
    const out = await collect(stream);
    await done;
    expect(out).toContain('<moxjs-fragment name="hi"></moxjs-fragment>');
    expect(out).toContain('data-moxjs-fragments');
    expect(out).toContain('id="moxjs-frag-data-hi"');
    expect(out).toContain('<h1>HI</h1>');
    expect(out).toContain('window.__moxjsFragment("hi")');
  });

  it('escapes </script> inside fragment HTML', async () => {
    const malicious = '<p>boom</p></script><script>alert(1)</script>';
    const { stream } = renderFragmentsToReadableStream({
      shell: '<moxjs-fragment name="x"/>',
      fragments: [{ name: 'x', render: async () => malicious }],
    });
    const out = await collect(stream);
    // Inside the data template the raw `</script>` is escaped
    expect(out).toContain('<\\/script');
  });

  it('does not emit a swap script for a timed-out fragment (fallback already in shell)', async () => {
    vi.useFakeTimers();
    try {
      const { stream, done } = renderFragmentsToReadableStream({
        shell: '<moxjs-fragment name="slow"/>',
        timeoutMs: 30,
        fragments: [{ name: 'slow', render: () => new Promise(() => {}), fallback: '<em>oops</em>' }],
      });
      const readerP = collect(stream);
      vi.advanceTimersByTime(40);
      vi.useRealTimers();
      const out = await readerP;
      const { outcomes } = await done;
      expect(out).not.toContain('id="moxjs-frag-data-slow"');
      expect(out).toContain('<em>oops</em>');
      expect(outcomes[0]!.phase).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('done promise resolves with the full outcome list', async () => {
    const { stream, done } = renderFragmentsToReadableStream({
      shell: '<moxjs-fragment name="a"/><moxjs-fragment name="b"/>',
      fragments: [
        { name: 'a', render: async () => '<x/>' },
        { name: 'b', render: async () => '<y/>' },
      ],
    });
    await collect(stream);
    const { outcomes } = await done;
    expect(outcomes.map((o) => o.name).sort()).toEqual(['a', 'b']);
  });
});
