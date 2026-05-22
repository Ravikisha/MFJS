/**
 * @moxjs/i18n — small MVP i18n primitives.
 *
 * Surface:
 *   - `formatMessage(template, values, locale?)` — ICU-lite interpolation with
 *     `{name}`, `{count, plural, one {…} other {…}}` and `{value, number}`.
 *   - `Catalog` — string → template map, by locale.
 *   - `createI18n(opts)` — main entry: `t(key, values)`, locale state,
 *     change-listener, lazy `load(locale)` for code-split catalogs.
 *   - `detectLocale(accept, supported, fallback)` — pure helper for SSR
 *     `Accept-Language` parsing.
 */

export type CatalogMessages = Record<string, string>;
export type Catalog = Record<string, CatalogMessages>;

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export interface FormatValues {
  [k: string]: string | number | boolean | undefined | null;
}

/** Strip the leading region tag — `en-US` → `en`. */
function baseLocale(locale: string): string {
  return locale.split(/[-_]/)[0]!.toLowerCase();
}

function pluralCategory(locale: string, n: number): PluralCategory {
  // Avoid pulling Intl.PluralRules in environments that lack it.
  const g = globalThis as { Intl?: { PluralRules?: new (l: string) => { select: (n: number) => PluralCategory } } };
  if (g.Intl?.PluralRules) {
    try {
      return new g.Intl.PluralRules(locale).select(n);
    } catch {
      /* fall through */
    }
  }
  return n === 1 ? 'one' : 'other';
}

const PLURAL_RE = /^([a-zA-Z_][\w]*),\s*plural,\s*([\s\S]+)$/;
const NUMBER_RE = /^([a-zA-Z_][\w]*),\s*number(?:,\s*([a-zA-Z]+))?$/;

function parsePluralArms(body: string): Partial<Record<PluralCategory | 'other', string>> {
  const out: Partial<Record<PluralCategory | 'other', string>> = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i]!)) i++;
    let key = '';
    while (i < body.length && /[a-zA-Z=0-9]/.test(body[i]!)) {
      key += body[i]!;
      i++;
    }
    while (i < body.length && /\s/.test(body[i]!)) i++;
    if (body[i] !== '{') break;
    i++;
    let depth = 1;
    let val = '';
    while (i < body.length && depth > 0) {
      const ch = body[i]!;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      val += ch;
      i++;
    }
    const normalKey = key.startsWith('=') ? key.slice(1) : key;
    out[normalKey as PluralCategory] = val;
  }
  return out;
}

/**
 * Interpolate `template`. Supports `{name}`, `{n, number}`, and
 * `{count, plural, one {…} other {…}}`.
 */
export function formatMessage(template: string, values: FormatValues = {}, locale = 'en'): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i]!;
    if (ch !== '{') {
      out += ch;
      i++;
      continue;
    }
    // Find the matching close brace, respecting nesting.
    let depth = 1;
    let body = '';
    i++;
    while (i < template.length && depth > 0) {
      const c = template[i]!;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      body += c;
      i++;
    }
    const trimmed = body.trim();
    const plural = PLURAL_RE.exec(trimmed);
    if (plural) {
      const name = plural[1]!;
      const arms = parsePluralArms(plural[2]!);
      const raw = values[name];
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isNaN(n)) {
        if (arms[String(n) as PluralCategory] !== undefined) {
          out += formatMessage(arms[String(n) as PluralCategory]!.replace(/#/g, String(n)), values, locale);
        } else {
          const cat = pluralCategory(locale, n);
          const tpl = arms[cat] ?? arms.other ?? '';
          out += formatMessage(tpl.replace(/#/g, String(n)), values, locale);
        }
      }
      continue;
    }
    const num = NUMBER_RE.exec(trimmed);
    if (num) {
      const name = num[1]!;
      const style = num[2];
      const raw = values[name];
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(n)) continue;
      const g = globalThis as { Intl?: typeof Intl };
      if (style === 'percent' && g.Intl?.NumberFormat) {
        out += new g.Intl.NumberFormat(locale, { style: 'percent' }).format(n);
      } else if (g.Intl?.NumberFormat) {
        out += new g.Intl.NumberFormat(locale).format(n);
      } else {
        out += String(n);
      }
      continue;
    }
    // Simple placeholder: `{name}`.
    const value = values[trimmed];
    out += value === undefined || value === null ? `{${trimmed}}` : String(value);
  }
  return out;
}

// ── I18n instance ─────────────────────────────────────────────────────────

export interface CreateI18nOptions {
  /** Initial locale. */
  locale: string;
  /** Catalogs the runtime starts with. */
  catalogs?: Catalog;
  /** Fallback locale used when a key is missing in the active locale. */
  fallbackLocale?: string;
  /** Lazy loader for additional locales. */
  loader?: (locale: string) => Promise<CatalogMessages>;
}

export interface I18n {
  locale: string;
  /** Translate `key`. Missing key returns `key`. */
  t(key: string, values?: FormatValues): string;
  /** Change the active locale. Triggers listeners. */
  setLocale(locale: string): Promise<void>;
  /** Subscribe to locale or catalog changes. */
  subscribe(listener: () => void): () => void;
  /** Load a catalog without switching locales. */
  load(locale: string): Promise<void>;
  /** Inspect / mutate raw catalogs (for tests + SSR hydration). */
  catalogs: Catalog;
}

export function createI18n(opts: CreateI18nOptions): I18n {
  const state = {
    locale: opts.locale,
    catalogs: { ...(opts.catalogs ?? {}) } as Catalog,
  };
  const listeners = new Set<() => void>();
  const fallback = opts.fallbackLocale;

  function notify() {
    for (const l of [...listeners]) {
      try {
        l();
      } catch {
        /* swallow */
      }
    }
  }

  async function ensureLoaded(locale: string): Promise<void> {
    if (state.catalogs[locale] || !opts.loader) return;
    state.catalogs[locale] = await opts.loader(locale);
  }

  return {
    get locale() {
      return state.locale;
    },
    set locale(_v: string) {
      throw new Error('[moxjs/i18n] use setLocale(locale) instead of mutating directly.');
    },
    t(key, values) {
      const cur = state.catalogs[state.locale]?.[key];
      const base = state.catalogs[baseLocale(state.locale)]?.[key];
      const fb = fallback ? state.catalogs[fallback]?.[key] : undefined;
      const template = cur ?? base ?? fb ?? key;
      return formatMessage(template, values, state.locale);
    },
    async setLocale(locale) {
      await ensureLoaded(locale);
      state.locale = locale;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async load(locale) {
      await ensureLoaded(locale);
      notify();
    },
    get catalogs() {
      return state.catalogs;
    },
  };
}

// ── Locale detection ──────────────────────────────────────────────────────

/**
 * Parse an `Accept-Language` header and return the best supported locale.
 *
 * Falls back to `fallback`. Exact match wins over base-language match.
 */
export function detectLocale(
  acceptLanguage: string | undefined,
  supported: string[],
  fallback: string,
): string {
  if (!acceptLanguage || !supported.length) return fallback;
  const requested = acceptLanguage
    .split(',')
    .map((s) => {
      const [tag, qPart] = s.trim().split(';');
      const q = qPart && /q=([0-9.]+)/.exec(qPart);
      return { tag: tag!.trim().toLowerCase(), q: q ? Number(q[1]) : 1 };
    })
    .filter((r) => r.tag)
    .sort((a, b) => b.q - a.q);

  const supportedLower = supported.map((s) => s.toLowerCase());
  // Exact match first.
  for (const r of requested) {
    const idx = supportedLower.indexOf(r.tag);
    if (idx !== -1) return supported[idx]!;
  }
  // Then base-language match.
  for (const r of requested) {
    const base = r.tag.split('-')[0]!;
    const idx = supportedLower.findIndex((s) => s.split('-')[0] === base);
    if (idx !== -1) return supported[idx]!;
  }
  return fallback;
}
