import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'React Server Components',
  description:
    'RSC evaluation status for JORVEL. Why federation + RSC is hard, what we ship in the meantime, what the integration looks like when the wire format stabilizes.',
};

export default function Rsc() {
  return (
    <>
      <h1>React Server Components (evaluation)</h1>

      <Callout variant="warn" title="Status: not implemented">
        Rspack Module Federation does not yet ship a stable RSC wire-format bridge. This page tracks
        the design space and the workarounds you can use today.
      </Callout>

      <h2 id="background">Background — what RSC is, briefly</h2>
      <p>
        React Server Components run on the server only. They return a serialized payload (a stream
        of S-expressions referencing client component IDs) that the browser turns into a React tree.
        Components marked <code>&quot;use client&quot;</code> ship to the browser; everything else
        stays server-side. Net effect: smaller client bundles, direct data access (DB, file system),
        zero JS for purely-static regions.
      </p>

      <h2 id="why-blocked">Why is federation + RSC hard?</h2>
      <ol>
        <li>
          <strong>Two manifests, one tree.</strong> The host&apos;s RSC payload may reference client
          components living inside a remote bundle. Both manifests must align on module IDs and
          chunk URLs.
        </li>
        <li>
          <strong>Streaming with cross-boundary suspense.</strong> A suspense boundary in a remote
          must yield to the host&apos;s stream without re-introducing the full client-side waterfall.
        </li>
        <li>
          <strong>Server runtime shape.</strong> RSC needs <code>react-server</code> conditions in
          the resolver. Today, Rspack&apos;s server condition + Module Federation runtime do not
          share a canonical handshake.
        </li>
        <li>
          <strong>Action sites.</strong> Server actions (<code>&quot;use server&quot;</code>) need
          stable IDs across deployments — federated remotes break that by definition.
        </li>
      </ol>

      <h2 id="meantime">In the meantime — what to use today</h2>
      <p>
        Most of the value props RSC unlocks (zero-JS by default, progressive hydration, server-only
        data access) are reachable with primitives JORVEL already ships:
      </p>
      <table>
        <thead>
          <tr>
            <th>RSC value prop</th>
            <th>JORVEL today</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Zero JS for static regions</td>
            <td>
              <a href="/docs/islands">Islands hydration</a> with{' '}
              <code>strategy=&quot;visible&quot;</code> or <code>idle</code>
            </td>
          </tr>
          <tr>
            <td>Progressive payload</td>
            <td>
              <a href="/docs/ssr">Streaming SSR</a> via <code>renderRouteToReadableStream</code>
            </td>
          </tr>
          <tr>
            <td>Server-only data access</td>
            <td>
              <code>defineLoader</code> + <code>runLoaders</code> from <code>@jorvel/ssr</code>
            </td>
          </tr>
          <tr>
            <td>Smaller client bundles</td>
            <td>
              <code>clientBoundary()</code> markers + <code>Island</code> wrappers — fetch the chunk
              only when needed
            </td>
          </tr>
        </tbody>
      </table>

      <h2 id="loader-pattern">Server-data-without-RSC pattern</h2>
      <p>
        For the common &quot;render this page with data fetched server-side&quot; case, the loader
        + hydration helper does the job today. Server runs the loader, payload is serialized into
        the HTML, the client hydrates the same component with the same data — no API layer needed.
      </p>
      <CodeBlock
        language="tsx"
        filename="apps/dashboard/src/pages/users/[id].tsx"
        code={`import { defineLoader, useLoaderData } from '@jorvel/ssr';

export const loader = defineLoader(async ({ params, request }) => {
  const user = await db.user.findUnique({ where: { id: params.id } });
  if (!user) throw new Response('Not Found', { status: 404 });
  return { user };
});

export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();
  return <h1>{user.name}</h1>;
}`}
      />

      <h2 id="planned">Planned integration when RSC lands</h2>
      <p>
        We&apos;ll keep the public API stable and ship federation-aware primitives behind a new
        package. Sketch:
      </p>
      <ol>
        <li>
          <code>@jorvel/rsc</code> — RSC-aware remote loader, manifest stitcher, action ID rebaser.
        </li>
        <li>
          <code>RemoteOutlet</code> gains an <code>rscPayload</code> prop that swaps the React tree
          for an RSC stream.
        </li>
        <li>
          <code>@jorvel/ssr/edge</code> grows <code>createRscHandler({'{ App, manifest }'})</code>{' '}
          for edge runtimes that can read the React server bundle.
        </li>
        <li>
          The generator updates <code>jorvel generate remote</code> to scaffold a{' '}
          <code>server.tsx</code> entry alongside <code>remote.tsx</code>; build emits two
          manifests.
        </li>
      </ol>

      <Callout variant="info" title="When to revisit">
        Track the upstream issue in <code>rspack/rspack</code> for the{' '}
        <code>react-server</code> condition + MF runtime alignment. Once that ships and{' '}
        <code>react-server-dom-webpack</code> publishes a federation-ready entry, JORVEL will follow
        within a release.
      </Callout>

      <h2 id="alternatives">Today, if you need RSC immediately</h2>
      <ul>
        <li>
          <strong>Next.js App Router</strong> for the single host, treat remotes as iframes or use a
          shared API layer. You lose federation but get RSC.
        </li>
        <li>
          <strong>Hybrid:</strong> ship the marketing surface in Next.js (RSC), the application
          shell in JORVEL (federation). They can share a design system and an auth domain.
        </li>
      </ul>
    </>
  );
}
