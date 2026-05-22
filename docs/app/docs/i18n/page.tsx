import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@moxjs/i18n',
  description:
    'Tiny ICU-lite interpolation, lazy catalogs, locale detection. Works on the server (Accept-Language) and the client.',
};

export default function I18nPage() {
  return (
    <>
      <h1>@moxjs/i18n</h1>
      <p>
        A ~3 KB i18n primitive shaped after ICU MessageFormat: simple placeholders, plural arms,
        number formatting, lazy catalogs, change-listener for re-rendering on locale swap. No
        dependencies beyond <code>Intl</code>.
      </p>

      <h2 id="quickstart">Quickstart</h2>
      <CodeBlock
        language="ts"
        code={`import { createI18n } from '@moxjs/i18n';

const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  catalogs: {
    en: {
      greet: 'Hello, {name}',
      items: '{count, plural, =0 {No items} one {# item} other {# items}}',
    },
    fr: {
      greet: 'Bonjour, {name}',
      items: '{count, plural, =0 {Aucun élément} one {# article} other {# articles}}',
    },
  },
});

i18n.t('greet', { name: 'Ada' });            // 'Hello, Ada'
i18n.t('items', { count: 3 });               // '3 items'

await i18n.setLocale('fr');
i18n.t('items', { count: 0 });               // 'Aucun élément'`}
      />

      <h2 id="interpolation">Interpolation grammar</h2>
      <table>
        <thead><tr><th>Token</th><th>Use</th></tr></thead>
        <tbody>
          <tr><td><code>{'{name}'}</code></td><td>Substitute a value</td></tr>
          <tr><td><code>{'{count, plural, one {…} other {…}}'}</code></td><td>Plural arm via <code>Intl.PluralRules</code></td></tr>
          <tr><td><code>{'{count, plural, =0 {…} other {…}}'}</code></td><td>Exact match wins over category</td></tr>
          <tr><td><code>{'{n, number}'}</code></td><td>Locale-aware grouping (1,234,567)</td></tr>
          <tr><td><code>{'{n, number, percent}'}</code></td><td>Percent style</td></tr>
          <tr><td><code>#</code></td><td>Inside a plural arm, substitutes the numeric value</td></tr>
        </tbody>
      </table>

      <h2 id="lazy-catalogs">Lazy catalogs</h2>
      <p>
        Pass a <code>loader</code> to fetch a catalog on demand. The first call to{' '}
        <code>setLocale(x)</code> awaits the loader and caches the result.
      </p>
      <CodeBlock
        language="ts"
        code={`const i18n = createI18n({
  locale: 'en',
  catalogs: { en: { greet: 'Hi, {name}' } },
  loader: async (locale) => {
    const res = await fetch(\`/locales/\${locale}.json\`);
    return await res.json();
  },
});

await i18n.setLocale('ja');               // fetches /locales/ja.json
i18n.t('greet', { name: 'Ada' });`}
      />

      <h2 id="ssr">SSR locale detection</h2>
      <p>
        <code>detectLocale(acceptLanguage, supported, fallback)</code> parses an{' '}
        <code>Accept-Language</code> header, respects <code>q</code> values, and prefers exact
        matches over base-language fallbacks.
      </p>
      <CodeBlock
        language="ts"
        code={`import { detectLocale, createI18n } from '@moxjs/i18n';

export async function handler(req: Request): Promise<Response> {
  const accept = req.headers.get('accept-language') ?? undefined;
  const locale = detectLocale(accept, ['en', 'fr-CA', 'ja'], 'en');
  const i18n = createI18n({ locale, catalogs: await loadCatalogs(locale) });
  // …render with i18n.t(...)
}`}
      />

      <Callout variant="info" title="Subscribe + re-render">
        <code>i18n.subscribe(fn)</code> notifies you on every <code>setLocale</code> /{' '}
        <code>load</code>. Wrap it in a React/Vue/Svelte adapter to re-render the tree.
      </Callout>
    </>
  );
}
