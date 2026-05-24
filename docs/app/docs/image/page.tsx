import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Image optimization',
  description:
    'Responsive <Image>, srcset generator, sizes helper, and LCP preload links. Pairs with the jorvel image CLI for WebP/AVIF derivative output.',
};

export default function ImageDocs() {
  return (
    <>
      <h1>Image optimization</h1>
      <p>
        Images are the single biggest payload on most pages. <code>@jorvel/runtime</code> ships an{' '}
        <code>&lt;Image&gt;</code> component plus pure helpers (<code>buildSrcset</code>,{' '}
        <code>buildSizes</code>, <code>buildImagePreloadLink</code>) that emit the right{' '}
        <code>srcset</code> / <code>sizes</code> attributes. Pair them with the{' '}
        <code>jorvel image</code> CLI to actually produce WebP / AVIF derivatives in CI.
      </p>

      <h2 id="component">The Image component</h2>
      <p>
        Drop in for a raw <code>&lt;img&gt;</code>. Renders a <code>&lt;picture&gt;</code> with one
        <code>&lt;source&gt;</code> per modern format, falls back to the legacy URL on browsers
        that don&apos;t support the modern formats. Always sets <code>width</code> /{' '}
        <code>height</code> attributes so the browser reserves layout space — zero CLS.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { Image } from '@jorvel/runtime';

<Image
  src="/img/hero-{w}.jpg"
  alt="Hero"
  width={1600}
  height={900}
  widths={[640, 1024, 1600, 1920]}
  formats={['avif', 'webp']}
  breakpoints={[
    { minWidth: 1280, size: '50vw' },
    { minWidth: 768,  size: '70vw' },
  ]}
/>`}
      />

      <Callout variant="info" title="Token rewriting">
        The <code>{`{w}`}</code> token is replaced with each width. If the URL has no token, the
        helper appends <code>?w=&lt;n&gt;</code> so CDN-side imagers (Vercel, Netlify, Cloudflare
        Image Resizing, your own CF worker) can resize on the fly.
      </Callout>

      <h2 id="props">Props</h2>
      <table>
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>src</code></td>
            <td><code>string</code></td>
            <td>URL template — supports <code>{`{w}`}</code> token or appends <code>?w=N</code>.</td>
          </tr>
          <tr>
            <td><code>alt</code></td>
            <td><code>string</code></td>
            <td>Required. Empty string for decorative images.</td>
          </tr>
          <tr>
            <td><code>width</code> / <code>height</code></td>
            <td><code>number</code></td>
            <td>Intrinsic dimensions. Always set both to prevent CLS.</td>
          </tr>
          <tr>
            <td><code>widths</code></td>
            <td><code>number[]</code></td>
            <td>Candidate widths for the <code>srcset</code>.</td>
          </tr>
          <tr>
            <td><code>formats</code></td>
            <td><code>('avif'|'webp'|'jpg')[]</code></td>
            <td>Emitted in order — first match wins.</td>
          </tr>
          <tr>
            <td><code>breakpoints</code></td>
            <td><code>{`{ minWidth, size }[]`}</code></td>
            <td>Drives the <code>sizes</code> attribute.</td>
          </tr>
          <tr>
            <td><code>fetchPriority</code></td>
            <td><code>'high' | 'low' | 'auto'</code></td>
            <td>Set <code>'high'</code> on the LCP image.</td>
          </tr>
          <tr>
            <td><code>loading</code></td>
            <td><code>'lazy' | 'eager'</code></td>
            <td>Defaults to <code>'lazy'</code> for everything below the fold.</td>
          </tr>
        </tbody>
      </table>

      <h2 id="helpers">Standalone helpers</h2>
      <p>
        Sometimes you want the <code>srcset</code> string for a CSS background-image or a native
        <code>&lt;img&gt;</code>. The pure helpers return strings and JSON.
      </p>
      <CodeBlock
        language="ts"
        code={`import { buildSrcset, buildSizes, buildImagePreloadLink } from '@jorvel/runtime';

buildSrcset('/img/hero-{w}.webp', { widths: [320, 640, 1280] });
// '/img/hero-320.webp 320w, /img/hero-640.webp 640w, /img/hero-1280.webp 1280w'

buildSrcset('/img/hero-{w}.webp', { density: [1, 2, 3] });
// '/img/hero-1000.webp 1x, /img/hero-2000.webp 2x, /img/hero-3000.webp 3x'

buildSizes({
  breakpoints: [{ minWidth: 1280, size: '33vw' }, { minWidth: 768, size: '50vw' }],
  fallback: '100vw',
});
// '(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw'

const link = buildImagePreloadLink('/img/lcp-{w}.webp', { widths: [640, 1280], fetchPriority: 'high' });
// <link rel="preload" as="image" imagesrcset="..." imagesizes="..." fetchpriority="high">`}
      />

      <h2 id="lcp">LCP — preloading the hero image</h2>
      <p>
        The Largest Contentful Paint is usually the hero. Preload it in the document head so the
        browser fetches it in parallel with the HTML. Use the same <code>sizes</code> attribute on
        the preload and the <code>&lt;img&gt;</code> so the browser picks the same candidate from
        the srcset.
      </p>
      <CodeBlock
        language="tsx"
        filename="apps/shell/src/template.tsx"
        code={`import { buildImagePreloadLink } from '@jorvel/runtime';

const heroPreload = buildImagePreloadLink('/img/hero-{w}.webp', {
  widths: [640, 1024, 1280, 1920],
  sizes: '(min-width: 1280px) 50vw, 100vw',
  fetchPriority: 'high',
});

export function Head() {
  return (
    <head>
      <link {...heroPreload} />
    </head>
  );
}`}
      />

      <h2 id="cli">Generating derivatives</h2>
      <p>
        Run the CLI in CI to produce WebP / AVIF copies at every target width. Output filenames
        follow the pattern the component expects (<code>name-{`<width>`}.webp</code>). Re-runs are
        cached on a content-hash basis so unchanged sources skip work.
      </p>
      <CodeBlock
        language="bash"
        code={`jorvel image \\
  --app shell \\
  --formats webp,avif \\
  --widths 320,640,1024,1280,1920 \\
  --quality 80`}
      />

      <table>
        <thead>
          <tr>
            <th>Flag</th>
            <th>Default</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>--formats</code></td><td><code>webp,avif</code></td><td>Comma-separated. <code>avif</code> is smaller but slower to encode.</td></tr>
          <tr><td><code>--widths</code></td><td><code>320,640,1024,1280,1920</code></td><td>Candidate widths. Match the <code>widths</code> prop on <code>&lt;Image&gt;</code>.</td></tr>
          <tr><td><code>--quality</code></td><td><code>80</code></td><td>1-100. 80 is usually invisible vs. lossless.</td></tr>
          <tr><td><code>--input</code></td><td><code>public/img</code></td><td>Source directory scanned recursively.</td></tr>
          <tr><td><code>--output</code></td><td>same as input</td><td>Derivatives written next to originals by default.</td></tr>
          <tr><td><code>--concurrency</code></td><td><code>cpus()</code></td><td>Cap when CI memory is tight.</td></tr>
        </tbody>
      </table>

      <h2 id="cdn">CDN-side resizing</h2>
      <p>
        For user-generated images, pre-generating every size is impractical. Set up your CDN imager
        to honor a <code>?w=N</code> query — the <code>Image</code> component picks that up
        automatically. Examples:
      </p>
      <table>
        <thead><tr><th>Provider</th><th>Query syntax</th></tr></thead>
        <tbody>
          <tr><td>Vercel</td><td><code>/_vercel/image?url=...&w=640&q=80</code> (use the wrapper imager)</td></tr>
          <tr><td>Cloudflare Image Resizing</td><td><code>/cdn-cgi/image/width=640/...</code></td></tr>
          <tr><td>imgix</td><td><code>?w=640&fm=webp</code></td></tr>
          <tr><td>Custom worker</td><td>Implement <code>?w=N&fmt=webp</code> contract</td></tr>
        </tbody>
      </table>

      <Callout variant="warn" title="Always set width and height">
        Missing intrinsic dimensions is the leading cause of CLS. The component prints a warning in
        dev if you forget. For unknown-size images (user uploads), persist the dimensions at upload
        time.
      </Callout>
    </>
  );
}
