export const metadata = { title: 'React Server Components' };

export default function Rsc() {
  return (
    <>
      <h1>React Server Components (evaluation)</h1>

      <div className="callout callout-warn">
        <strong>Status:</strong> not implemented. Rspack Module Federation does not yet ship stable RSC
        support. This page tracks the plan.
      </div>

      <h2>What RSC would unlock</h2>
      <ul>
        <li>Server-rendered components with zero client JS by default.</li>
        <li>Streaming payload — pages hydrate progressively as server work finishes.</li>
        <li>Direct data access (DB / file system) without API layer.</li>
        <li>Smaller client bundles — only interactive components hydrate.</li>
      </ul>

      <h2>What blocks it today</h2>
      <ul>
        <li>Rspack MF lacks a stable RSC wire format bridge.</li>
        <li>No canonical story for shared server/client component federation.</li>
        <li>Framework adapters (Next, Redwood, TanStack Start) lean on bespoke bundler integrations.</li>
      </ul>

      <h2>Our approach when RSC lands</h2>
      <ol>
        <li>Add <code>@moxjs/rsc</code> package with RSC-aware remote loader.</li>
        <li>Extend <code>RemoteOutlet</code> to accept an RSC payload stream.</li>
        <li>Ship <code>createRscHandler</code> in <code>@moxjs/ssr</code> for edge runtimes.</li>
        <li>Document the server/client split — <code>"use client"</code> boundary marks.</li>
      </ol>

      <h2>In the meantime</h2>
      <p>
        Use <a href="/docs/islands">Islands hydration</a> for zero-JS-by-default static + hydrated
        fragments. Use <a href="/docs/ssr">streaming SSR</a> for progressive rendering.
      </p>
    </>
  );
}
