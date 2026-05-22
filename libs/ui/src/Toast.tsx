import * as React from 'react';
import type { ReactNode } from 'react';

export type ToastVariant = 'info' | 'success' | 'warn' | 'error';

export interface ToastOptions {
  id?: string;
  variant?: ToastVariant;
  /** Auto-dismiss after this many milliseconds. 0 to disable. Default: 4000. */
  durationMs?: number;
  message: ReactNode;
}

export interface ToastRecord extends ToastOptions {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  push(opts: ToastOptions): string;
  dismiss(id: string): void;
  list: ToastRecord[];
}

const ToastCtx = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({
  children,
  now = Date.now,
}: {
  children: ReactNode;
  /** Time source for tests. */
  now?: () => number;
}) {
  const [list, setList] = React.useState<ToastRecord[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setList((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = React.useCallback(
    (opts: ToastOptions): string => {
      const id = opts.id ?? `toast-${now()}-${Math.random().toString(36).slice(2, 7)}`;
      const record: ToastRecord = { id, createdAt: now(), variant: 'info', durationMs: 4000, ...opts };
      setList((prev) => [...prev, record]);
      if (record.durationMs && record.durationMs > 0) {
        const handle = setTimeout(() => dismiss(id), record.durationMs);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss, now],
  );

  React.useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  return (
    <ToastCtx.Provider value={{ list, push, dismiss }}>
      {children}
      <ToastViewport />
    </ToastCtx.Provider>
  );
}

const VARIANT_COLOR: Record<ToastVariant, string> = {
  info: 'var(--moxjs-color-primary, #4f46e5)',
  success: '#16a34a',
  warn: '#f59e0b',
  error: '#ef4444',
};

function ToastViewport() {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 1001,
      }}
    >
      {ctx.list.map((t) => (
        <div
          key={t.id}
          data-variant={t.variant}
          style={{
            background: VARIANT_COLOR[t.variant ?? 'info'],
            color: '#fff',
            padding: '8px 12px',
            borderRadius: 'var(--moxjs-radius-md, 6px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: 240,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error('[moxjs/ui] useToast must be used inside <ToastProvider>');
  return ctx;
}
