import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Font optimization',
  description:
    'Self-host fonts with preload + font-display: swap, or compose a Google Fonts URL with preconnect. Pure-data helpers safe on workers.',
};

export default function FontsDocs() {
  return (
    <>
      <h1>Font optimization</h1>
      <p>
        <code>@moxjs/runtime</code> ships small helpers to render the right{' '}
        <code>&lt;link rel=&quot;preload&quot;&gt;</code> and <code>@font-face</code> blocks for
        self-hosted fonts, plus a Google Fonts URL composer that wires{' '}
        <code>display=swap</code> and weight axes correctly.
      </p>

      <h2 id="self-host">Self-host preload + @font-face</h2>
      <CodeBlock
        language="tsx"
        code={`import { buildFontPreloadLink, buildFontFaceCss } from '@moxjs/runtime';

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
      <Callout variant="info" title="Always crossorigin=anonymous">
        Preloaded fonts only avoid a double-fetch if the preload link and the eventual{' '}
        <code>@font-face</code> request use the same CORS mode. The helper hard-codes{' '}
        <code>crossorigin=&quot;anonymous&quot;</code> for that reason.
      </Callout>

      <h2 id="google-fonts">Google Fonts</h2>
      <CodeBlock
        language="ts"
        code={`import { googleFontsUrl, googleFontsPreconnectLinks } from '@moxjs/runtime';

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
    </>
  );
}
