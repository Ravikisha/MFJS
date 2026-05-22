import React from 'react';
import { dispatchMoxjsNavigate } from './router.js';
import { usePathname } from './routing.js';

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>, opts?: { replace?: boolean }) => void] {
  const path = usePathname();
  const [params, setParams] = React.useState<URLSearchParams>(() => readParams());

  React.useEffect(() => {
    setParams(readParams());
  }, [path]);

  const setter = React.useCallback(
    (next: URLSearchParams | Record<string, string>, opts?: { replace?: boolean }) => {
      const nextParams = next instanceof URLSearchParams ? next : new URLSearchParams(next);
      const query = nextParams.toString();
      const { pathname, hash } = window.location;
      const to = `${pathname}${query ? `?${query}` : ''}${hash}`;
      dispatchMoxjsNavigate({ to, mode: opts?.replace ? 'replace' : 'push' });
    },
    [],
  );

  return [params, setter];
}

function readParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function useQueryParam(key: string, defaultValue = ''): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;
  const setValue = React.useCallback(
    (v: string) => {
      const next = new URLSearchParams(params);
      if (v) next.set(key, v);
      else next.delete(key);
      setParams(next);
    },
    [key, params, setParams],
  );
  return [value, setValue];
}

export interface ParamsContextValue {
  params: Record<string, string>;
}

const ParamsContext = React.createContext<ParamsContextValue>({ params: {} });

export const ParamsProvider = ParamsContext.Provider;

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return React.useContext(ParamsContext).params as T;
}

export function useNavigate() {
  return React.useCallback(
    (to: string, opts?: { replace?: boolean; state?: unknown }) => {
      dispatchMoxjsNavigate({
        to,
        mode: opts?.replace ? 'replace' : 'push',
        state: opts?.state,
      });
    },
    [],
  );
}
