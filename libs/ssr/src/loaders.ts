/**
 * Per-route data loaders — getServerSideProps-style data fetching for JORVEL SSR.
 *
 * Each route can register a `defineLoader` that runs before render. The loader
 * receives a `LoaderContext` (URL, params, request, request-context) and may
 * return data, throw `redirect` / `json` / `notFound`, or set headers via the
 * provided helpers. Loaded data is exposed to components via{' '}
 * `useLoaderData<T>()` when the same key is read on the client.
 *
 * Loaders aren't a router replacement — they're a single resolution slot per
 * SSR render, so the data is hydration-ready without a second client fetch.
 */

import type { EdgeRequest } from './types.js';
import type { RequestContext } from './request-context.js';
import { getRequestContext } from './request-context.js';

export interface LoaderContext<P extends Record<string, string> = Record<string, string>> {
  request: EdgeRequest;
  url: URL;
  params: P;
  ctx: RequestContext | undefined;
  /** Set response headers from inside a loader (e.g. `Set-Cookie`). */
  setHeader(name: string, value: string): void;
}

export type LoaderFn<T = unknown, P extends Record<string, string> = Record<string, string>> = (
  c: LoaderContext<P>,
) => Promise<T> | T;

export interface LoaderDescriptor<T> {
  /** Stable key used to read the loaded data on the client. */
  key: string;
  /** The loader function. */
  load: LoaderFn<T>;
  /** Optional `cache-control` for the response when this loader resolves. */
  cacheControl?: string;
}

/** Type-narrowing helper that preserves the loader's return type. */
export function defineLoader<T, P extends Record<string, string> = Record<string, string>>(
  spec: { key: string; load: LoaderFn<T, P>; cacheControl?: string },
): LoaderDescriptor<T> {
  return spec as LoaderDescriptor<T>;
}

// ── Runtime slot — set by the edge adapter, read by components ────────────

interface LoaderSlot {
  data: Record<string, unknown>;
  headers: Record<string, string>;
}

const SLOT_KEY = '__JORVEL_LOADER_SLOT__';

function slot(): LoaderSlot | undefined {
  return (globalThis as Record<string, unknown>)[SLOT_KEY] as LoaderSlot | undefined;
}

function ensureSlot(): LoaderSlot {
  const g = globalThis as Record<string, unknown>;
  if (!g[SLOT_KEY]) g[SLOT_KEY] = { data: {}, headers: {} };
  return g[SLOT_KEY] as LoaderSlot;
}

export function _clearLoaderSlot(): void {
  const g = globalThis as Record<string, unknown>;
  delete g[SLOT_KEY];
}

/** Read loaded data by key from inside a component. Returns `undefined` when missing. */
export function useLoaderData<T>(key: string): T | undefined {
  return slot()?.data[key] as T | undefined;
}

/** Same as `useLoaderData` but throws when the slot is missing — for routes that require it. */
export function requireLoaderData<T>(key: string): T {
  const v = slot()?.data[key];
  if (v === undefined) {
    throw new Error(`[jorvel/ssr] No loader data for key "${key}". Did the route register one?`);
  }
  return v as T;
}

/** SSR boot helper to seed the slot from a serialized payload (hydration). */
export function setLoaderData(data: Record<string, unknown>): void {
  ensureSlot().data = { ...ensureSlot().data, ...data };
}

// ── Runner used by the edge adapter ───────────────────────────────────────

export interface RunLoadersOptions {
  loaders: LoaderDescriptor<unknown>[];
  request: EdgeRequest;
  params?: Record<string, string>;
}

export interface RunLoadersResult {
  data: Record<string, unknown>;
  headers: Record<string, string>;
  cacheControl?: string;
}

/**
 * Run a list of loaders concurrently and aggregate their data + headers.
 * Throws propagate (a loader can throw `redirect` / `json` / `notFound`).
 */
export async function runLoaders(opts: RunLoadersOptions): Promise<RunLoadersResult> {
  ensureSlot();
  const url = new URL(opts.request.url);
  const ctx = getRequestContext();
  const collected: RunLoadersResult = { data: {}, headers: {} };

  const setHeader = (name: string, value: string) => {
    collected.headers[name.toLowerCase()] = value;
  };

  // Run concurrently; the first thrown control-flow error wins.
  const results = await Promise.all(
    opts.loaders.map(async (loader) => {
      const data = await loader.load({
        request: opts.request,
        url,
        params: opts.params ?? {},
        ctx,
        setHeader,
      });
      return { loader, data };
    }),
  );
  for (const { loader, data } of results) {
    collected.data[loader.key] = data;
    if (loader.cacheControl) {
      // Keep the most conservative cacheControl — later cache merging is
      // the adapter's responsibility.
      collected.cacheControl = collected.cacheControl ?? loader.cacheControl;
    }
  }
  ensureSlot().data = { ...ensureSlot().data, ...collected.data };
  ensureSlot().headers = { ...ensureSlot().headers, ...collected.headers };
  return collected;
}
