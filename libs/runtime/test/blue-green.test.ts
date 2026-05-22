import { describe, expect, it, vi } from 'vitest';
import {
  BlueGreenRegistry,
  shapeHealthCheck,
  type BlueGreenManifest,
  type BlueGreenTransition,
} from '../src/blue-green.js';

const m = (remotes: Array<{ name: string; entryUrl: string }>, version?: string): BlueGreenManifest => ({
  ...(version !== undefined ? { version } : {}),
  remotes,
});

describe('BlueGreenRegistry', () => {
  it('initial blue is what was passed; previous() is null', () => {
    const reg = new BlueGreenRegistry({ initial: m([{ name: 'a', entryUrl: 'A' }], 'v1') });
    expect(reg.current().remotes).toEqual([{ name: 'a', entryUrl: 'A' }]);
    expect(reg.previous()).toBeNull();
  });

  it('clones the input — caller mutation does not leak into the registry', () => {
    const initial = m([{ name: 'a', entryUrl: 'A' }]);
    const reg = new BlueGreenRegistry({ initial });
    initial.remotes.push({ name: 'b', entryUrl: 'B' });
    expect(reg.current().remotes).toHaveLength(1);
  });

  it('stage returns a unique slot id and exposes it via listStaged', () => {
    const reg = new BlueGreenRegistry({ initial: m([{ name: 'a', entryUrl: 'A' }]) });
    const id1 = reg.stage(m([{ name: 'a', entryUrl: 'A2' }]));
    const id2 = reg.stage(m([{ name: 'a', entryUrl: 'A3' }]));
    expect(id1).not.toBe(id2);
    expect(reg.listStaged().sort()).toEqual([id1, id2].sort());
  });

  it('promote swaps blue to the staged manifest and stashes the previous', async () => {
    const reg = new BlueGreenRegistry({ initial: m([{ name: 'a', entryUrl: 'A' }]) });
    const id = reg.stage(m([{ name: 'a', entryUrl: 'A2' }, { name: 'b', entryUrl: 'B' }]));
    await reg.promote(id);
    expect(reg.current().remotes.map((r) => r.name)).toEqual(['a', 'b']);
    expect(reg.previous()?.remotes).toEqual([{ name: 'a', entryUrl: 'A' }]);
    expect(reg.listStaged()).toEqual([]);
  });

  it('promote runs the health check and rejects when it returns false', async () => {
    const events: BlueGreenTransition[] = [];
    const reg = new BlueGreenRegistry({
      initial: m([{ name: 'a', entryUrl: 'A' }]),
      healthCheck: () => false,
      onTransition: (e) => events.push(e),
    });
    const id = reg.stage(m([{ name: 'a', entryUrl: 'A2' }]));
    await expect(reg.promote(id)).rejects.toThrow(/health check returned false/);
    expect(reg.current().remotes[0]!.entryUrl).toBe('A'); // unchanged
    expect(events.map((e) => e.type)).toContain('promote-failed');
  });

  it('promote catches health check exceptions and rolls back', async () => {
    const reg = new BlueGreenRegistry({
      initial: m([{ name: 'a', entryUrl: 'A' }]),
      healthCheck: () => { throw new Error('probe-network-error'); },
    });
    const id = reg.stage(m([{ name: 'a', entryUrl: 'A2' }]));
    await expect(reg.promote(id)).rejects.toThrow(/probe-network-error/);
    expect(reg.current().remotes[0]!.entryUrl).toBe('A');
  });

  it('promote fails with timeout when the health check exceeds healthTimeoutMs', async () => {
    vi.useFakeTimers();
    try {
      const reg = new BlueGreenRegistry({
        initial: m([{ name: 'a', entryUrl: 'A' }]),
        healthCheck: () => new Promise(() => {}),
        healthTimeoutMs: 100,
      });
      const id = reg.stage(m([{ name: 'a', entryUrl: 'A2' }]));
      const promise = reg.promote(id);
      vi.advanceTimersByTime(120);
      await expect(promise).rejects.toThrow(/timed out after 100ms/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rollback restores the previous blue and clears `previous`', async () => {
    const reg = new BlueGreenRegistry({ initial: m([{ name: 'a', entryUrl: 'A' }]) });
    const id = reg.stage(m([{ name: 'b', entryUrl: 'B' }]));
    await reg.promote(id);
    const restored = reg.rollback();
    expect(restored.remotes).toEqual([{ name: 'a', entryUrl: 'A' }]);
    expect(reg.current().remotes).toEqual([{ name: 'a', entryUrl: 'A' }]);
    expect(reg.previous()).toBeNull();
  });

  it('rollback throws when there is no previous blue', () => {
    const reg = new BlueGreenRegistry({ initial: m([{ name: 'a', entryUrl: 'A' }]) });
    expect(() => reg.rollback()).toThrow(/nothing to rollback/);
  });

  it('subscribe fires on promote and rollback, can be unsubscribed', async () => {
    const reg = new BlueGreenRegistry({ initial: m([{ name: 'a', entryUrl: 'A' }]) });
    const fn = vi.fn();
    const off = reg.subscribe(fn);
    const id = reg.stage(m([{ name: 'b', entryUrl: 'B' }]));
    await reg.promote(id);
    expect(fn).toHaveBeenCalledTimes(1);
    reg.rollback();
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    const id2 = reg.stage(m([{ name: 'c', entryUrl: 'C' }]));
    await reg.promote(id2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('promote rejects an unknown slot id', async () => {
    const reg = new BlueGreenRegistry({ initial: m([{ name: 'a', entryUrl: 'A' }]) });
    await expect(reg.promote('green-99')).rejects.toThrow(/no staged slot/);
  });

  it('emits onTransition for staged + promote-start + promote-success', async () => {
    const events: BlueGreenTransition[] = [];
    const reg = new BlueGreenRegistry({
      initial: m([{ name: 'a', entryUrl: 'A' }]),
      onTransition: (e) => events.push(e),
    });
    const id = reg.stage(m([{ name: 'b', entryUrl: 'B' }]));
    await reg.promote(id);
    expect(events.map((e) => e.type)).toEqual(['staged', 'promote-start', 'promote-success']);
  });

  it('reads via current() are atomic — concurrent reads see one manifest', async () => {
    const reg = new BlueGreenRegistry({ initial: m([{ name: 'a', entryUrl: 'A' }]) });
    const id = reg.stage(m([{ name: 'a', entryUrl: 'A2' }]));
    // Read before/after — should be A then A2; never a half-blend.
    const before = reg.current();
    await reg.promote(id);
    const after = reg.current();
    expect(before.remotes[0]!.entryUrl).toBe('A');
    expect(after.remotes[0]!.entryUrl).toBe('A2');
  });
});

describe('shapeHealthCheck', () => {
  it('rejects empty remote lists', async () => {
    const gate = shapeHealthCheck({ previous: m([{ name: 'a', entryUrl: 'A' }]) });
    expect(await gate(m([]))).toBe(false);
  });

  it('rejects duplicate remote names', async () => {
    const gate = shapeHealthCheck({ previous: m([{ name: 'a', entryUrl: 'A' }]) });
    const dup = m([{ name: 'a', entryUrl: 'A' }, { name: 'a', entryUrl: 'B' }]);
    expect(await gate(dup)).toBe(false);
  });

  it('rejects when next shrinks past maxShrinkRatio', async () => {
    const previous = m([
      { name: 'a', entryUrl: '/a' },
      { name: 'b', entryUrl: '/b' },
      { name: 'c', entryUrl: '/c' },
      { name: 'd', entryUrl: '/d' },
    ]);
    const gate = shapeHealthCheck({ previous, maxShrinkRatio: 0.5 });
    expect(await gate(m([{ name: 'a', entryUrl: '/a' }]))).toBe(false);
    expect(await gate(m([
      { name: 'a', entryUrl: '/a' },
      { name: 'b', entryUrl: '/b' },
      { name: 'c', entryUrl: '/c' },
    ]))).toBe(true);
  });

  it('accepts a manifest that grows', async () => {
    const previous = m([{ name: 'a', entryUrl: '/a' }]);
    const gate = shapeHealthCheck({ previous });
    expect(await gate(m([
      { name: 'a', entryUrl: '/a' },
      { name: 'b', entryUrl: '/b' },
    ]))).toBe(true);
  });
});
