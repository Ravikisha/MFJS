import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Image optimization',
  description:
    'Responsive <Image>, srcset generator, sizes helper, and LCP preload links. Pairs with the moxjs image CLI for WebP/AVIF derivative output.',
};

export default function ImageDocs() {
  return (
    <>
      <h1>Image optimization</h1>
      <p>
        <code>@moxjs/runtime</code> ships a small <code>&lt;Image&gt;</code> component plus pure
        helpers (<code>buildSrcset</code>, <code>buildSizes</code>,{' '}
        <code>buildImagePreloadLink</code>) that emit the right <code>srcset</code> /{' '}
        <code>sizes</code> attributes. Pair with the <code>moxjs image</code> CLI to actually
        produce WebP / AVIF derivatives.
      </p>

      <h2 id="component">The Image component</h2>
      <CodeBlock
        language="tsx"
        code={`import { Image } from '@moxjs/runtime';

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
        helper appends <code>?w=&lt;n&gt;</code> so CDN-side imagers (Vercel, Netlify,
        Cloudflare, your-own-cf-worker) can resize on the fly.
      </Callout>

      <h2 id="helpers">Standalone helpers</h2>
      <CodeBlock
        language="ts"
        code={`import { buildSrcset, buildSizes, buildImagePreloadLink } from '@moxjs/runtime';

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

      <h2 id="cli">Generating derivatives</h2>
      <p>
        Run the CLI in CI to produce WebP/AVIF copies at every target width. The output filenames
        follow the pattern the component expects.
      </p>
      <CodeBlock
        language="bash"
        code={`moxjs image \\
  --app shell \\
  --formats webp,avif \\
  --widths 320,640,1024,1280,1920 \\
  --quality 80`}
      />
    </>
  );
}
