import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Font optimization',
  description:
    'Self-host fonts with preload + font-display: swap, or compose a Google Fonts URL with preconnect. Pure-data helpers safe on workers — no DOM dependency, no side effects.',
};

export default function FontsDocs() {
  return (
    <>
      <h1>Font optimization</h1>
      <p>
        Fonts are one of the biggest first-paint costs. Loaded badly they cause FOIT (flash of
        invisible text), CLS (layout shift from fallback metrics), and an extra DNS hop. The
        helpers in <code>@jorvel/runtime</code> emit the correct <code>&lt;link&gt;</code> tags and{' '}
        <code>@font-face</code> blocks so the browser can preload, swap, and avoid the double-fetch
        trap.
      </p>

      <Callout variant="info" title="Pure-data helpers">
        These functions return plain JSON / strings. They have no DOM dependency, throw nothing on
        the server, and ship in the edge bundle of <code>@jorvel/ssr</code>. You can paste their
        output straight into an SSR template head.
      </Callout>

      <h2 id="self-host">Self-host: preload + @font-face</h2>
      <p>
        Self-hosting beats third-party CDNs for two reasons: no extra DNS lookup, and Service-Worker
        caching is straightforward. The preload + <code>@font-face</code> pair gets you swap
        behavior without a flash of invisible text.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { buildFontPreloadLink, buildFontFaceCss } from '@jorvel/runtime';

const preload = buildFontPreloadLink('/fonts/inter.woff2');
// { rel: 'preload', as: 'font', href: '/fonts/inter.woff2', type: 'font/woff2', crossorigin: 'anonymous' }

const css = buildFontFaceCss([
  { family: 'Inter',          src: '/fonts/inter-400.woff2', weight: 400 },
  { family: 'Inter',          src: '/fonts/inter-700.woff2', weight: 700 },
  { family: 'IBM Plex Mono',  src: '/fonts/plex-400.woff2',  weight: 400, unicodeRange: 'U+0000-00FF' },
]);
// @font-face { font-family: "Inter"; src: url("/fonts/inter-400.woff2") format("woff2"); font-display: swap; font-weight: 400; }
// ...`}
      />

      <Callout variant="warn" title="Always crossorigin=anonymous">
        Preloaded fonts only avoid a double-fetch if the preload link and the eventual{' '}
        <code>@font-face</code> request use the same CORS mode. The helper hard-codes{' '}
        <code>crossorigin=&quot;anonymous&quot;</code> for that reason. If your font CDN does not
        send <code>Access-Control-Allow-Origin: *</code>, the browser will fetch the file twice and
        the preload becomes a regression.
      </Callout>

      <h2 id="ssr-head">Wiring into an SSR head</h2>
      <p>
        Combine the two helpers in the document head. Put the preload link before the stylesheet so
        the browser starts the request as early as possible.
      </p>
      <CodeBlock
        language="tsx"
        filename="apps/shell/src/template.tsx"
        code={`import { buildFontPreloadLink, buildFontFaceCss } from '@jorvel/runtime';

const PRELOADS = [
  buildFontPreloadLink('/fonts/inter-400.woff2'),
  buildFontPreloadLink('/fonts/inter-700.woff2'),
];

const FACE_CSS = buildFontFaceCss([
  { family: 'Inter', src: '/fonts/inter-400.woff2', weight: 400 },
  { family: 'Inter', src: '/fonts/inter-700.woff2', weight: 700 },
]);

export function Head() {
  return (
    <head>
      {PRELOADS.map((link) => (
        <link key={link.href} {...link} />
      ))}
      <style dangerouslySetInnerHTML={{ __html: FACE_CSS }} />
    </head>
  );
}`}
      />

      <h2 id="google-fonts">Google Fonts</h2>
      <p>
        The composer URL-encodes weight / italic axes correctly and bakes in{' '}
        <code>display=swap</code>. Pair with the preconnect helper so the DNS + TLS handshake to{' '}
        <code>fonts.gstatic.com</code> happens in parallel with HTML parsing.
      </p>
      <CodeBlock
        language="ts"
        code={`import { googleFontsUrl, googleFontsPreconnectLinks } from '@jorvel/runtime';

googleFontsUrl({
  families: [
    { family: 'Inter', weights: [400, 700] },
    { family: 'IBM Plex Mono', weights: [{ italic: false, weight: 400 }, { italic: true, weight: 400 }] },
  ],
});
// https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=IBM+Plex+Mono:ital,wght@0,400;1,400&display=swap

googleFontsPreconnectLinks();
// [
//   { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
//   { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
// ]`}
      />

      <h2 id="variable-fonts">Variable fonts</h2>
      <p>
        Variable fonts ship every weight in one file. Pass a single <code>src</code> and let
        Rspack&apos;s asset module handle the URL hash. The <code>weight</code> field becomes a
        range like <code>100 900</code>:
      </p>
      <CodeBlock
        language="ts"
        code={`buildFontFaceCss([
  { family: 'Inter', src: '/fonts/inter-variable.woff2', weight: '100 900' },
]);`}
      />

      <h2 id="performance">Performance checklist</h2>
      <ul>
        <li>
          <strong>Subset before shipping.</strong> Use <code>pyftsubset</code> to strip glyph ranges
          your product never uses — typically Latin Extended cuts file size by 60-80%.
        </li>
        <li>
          <strong>Two weights max in the critical path.</strong> Each additional weight is another
          file the browser blocks on. Defer non-critical weights with{' '}
          <code>font-display: optional</code>.
        </li>
        <li>
          <strong>Preload only what renders above the fold.</strong> Preloading every weight
          ratchets up bandwidth without improving LCP.
        </li>
        <li>
          <strong>Use <code>size-adjust</code> for the fallback.</strong> Pair the web font with a
          system fallback (<code>system-ui</code>) tuned to similar x-height to minimize CLS during
          the swap window.
        </li>
        <li>
          <strong>WOFF2 only.</strong> WOFF and TTF/OTF are 30-50% larger and only used by
          IE11/Android 4. The helper does not emit fallbacks for those formats by default.
        </li>
      </ul>

      <h2 id="csp">CSP impact</h2>
      <p>
        Self-hosted fonts need <code>font-src 'self'</code>. Google Fonts needs{' '}
        <code>font-src https://fonts.gstatic.com</code> and{' '}
        <code>style-src https://fonts.googleapis.com</code>. The <code>buildCsp</code> helper in{' '}
        <code>@jorvel/security</code> can take a list of allowed font origins; otherwise the
        browser blocks the request with no console error.
      </p>
    </>
  );
}
