import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Typed routes',
  description:
    'Bind paths to validators (Zod, Valibot, Yup, custom). Compile-time types + runtime validation for params and search.',
};

export default function TypedRoutes() {
  return (
    <>
      <h1>Typed routes</h1>
      <p>
        <code>createRoute</code> binds a path to a validator (Zod, Valibot, Yup, anything with{' '}
        <code>parse</code>). You get compile-time types + runtime validation for params and search,
        plus a typed <code>build()</code> helper so you can never construct a broken URL.
      </p>
      <Callout variant="success" title="Why bother?">
        Untyped <code>useParams()</code> returns <code>Record&lt;string, string&gt;</code>. By the
        time a typo lands in production it has already cost a refund. <code>createRoute</code>
        turns &quot;page broken because <code>userid</code> ≠ <code>userId</code>&quot; into a
        red squiggle in the IDE.
      </Callout>

      <h2>Zod example</h2>
      <CodeBlock
        language="ts"
        code={`import { z } from 'zod';
import { createRoute, defineRoutes } from '@moxjs/runtime';

const userRoute = createRoute({
  path: '/users/:id',
  params: z.object({ id: z.string().uuid() }),
  search: z.object({ tab: z.enum(['profile', 'billing']).default('profile') }),
});

export const routes = defineRoutes({ user: userRoute });

// match
const m = userRoute.match('/users/abc-def');
if (m) m.params.id; // typed string (uuid validated)

// build
const url = userRoute.build({ id: 'abc' }, { tab: 'billing' });
// -> '/users/abc?tab=billing'`}
      />

      <h2>No validator — raw params</h2>
      <p>
        Omit <code>params</code> to get <code>Record&lt;string, string&gt;</code>:
      </p>
      <CodeBlock
        language="ts"
        code={`const r = createRoute({ path: '/orders/:orderId' });
r.match('/orders/42')?.params.orderId;  // string`}
      />

      <h2>defineRoutes — route registry</h2>
      <p>
        Group routes into one object and reference them by key. Build URLs without sprinkling
        string literals across the codebase.
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineRoutes, createRoute } from '@moxjs/runtime';
import { z } from 'zod';

export const routes = defineRoutes({
  home:    createRoute({ path: '/' }),
  user:    createRoute({
    path: '/users/:id',
    params: z.object({ id: z.string().uuid() }),
    search: z.object({ tab: z.enum(['profile', 'billing']).default('profile') }),
  }),
  invoice: createRoute({
    path: '/billing/invoices/:invoiceId',
    params: z.object({ invoiceId: z.string().regex(/^inv_\\w+$/) }),
  }),
});

// Use anywhere
const url = routes.user.build({ id: crypto.randomUUID() }, { tab: 'billing' });
dispatchMoxjsNavigate({ to: url });`}
      />

      <h2>Read params inside a page</h2>
      <CodeBlock
        language="tsx"
        code={`import { useParams } from '@moxjs/runtime';
import type { z } from 'zod';
import { routes } from '@/routes';

type UserParams = z.infer<typeof routes.user['_paramsSchema']>;

export default function UserPage() {
  const { id } = useParams<UserParams>();   // 'string' (uuid validated upstream)
  return <h1>User {id}</h1>;
}`}
      />

      <h2>Validation failure modes</h2>
      <table>
        <thead>
          <tr><th>Call</th><th>On invalid input</th></tr>
        </thead>
        <tbody>
          <tr><td><code>route.match(pathname)</code></td><td>Returns <code>null</code> — caller falls through to the next route.</td></tr>
          <tr><td><code>route.parse(input)</code></td><td>Throws the validator&apos;s error (Zod error, Yup error, etc).</td></tr>
          <tr><td><code>route.safeParse(input)</code></td><td><code>{`{ success: true, data }`}</code> or <code>{`{ success: false, error }`}</code>.</td></tr>
        </tbody>
      </table>

      <h2>Custom validator</h2>
      <p>
        Any object with a <code>parse(input): T</code> method works — implement <code>safeParse</code> for
        non-throwing validation.
      </p>
      <CodeBlock
        language="ts"
        code={`const validator = {
  parse: (x: unknown) => {
    if (!x || typeof (x as any).id !== 'string') throw new Error('bad params');
    return x as { id: string };
  },
};
createRoute({ path: '/x/:id', params: validator });`}
      />
    </>
  );
}
