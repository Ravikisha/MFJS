'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  active: string;
  setActive: (next: string) => void;
}
const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = React.useState(defaultValue);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={cn('not-prose my-5 rounded-xl border border-border bg-card', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex flex-wrap gap-1 border-b border-border bg-secondary/40 px-2 pt-2 -mb-px',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error('TabsTrigger must be inside <Tabs>');
  const active = ctx.active === value;
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      onClick={() => ctx.setActive(value)}
      className={cn(
        'inline-flex items-center gap-2 rounded-t-md px-3 py-2 text-xs font-medium transition',
        active
          ? 'bg-card text-foreground border border-border border-b-card relative top-px'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext);
  if (!ctx || ctx.active !== value) return null;
  // When a TabsContent's only child is a <CodeBlock>, the outer Tabs card
  // already provides the rounded border — flatten the inner code-block so we
  // don't render two stacked cards. For prose children, padding kicks in via
  // the `:not(:has(...))` selector so text layouts still get a comfortable gutter.
  return (
    <div
      className={cn(
        'tabs-content',
        '[&>.code-block]:my-0 [&>.code-block]:rounded-none [&>.code-block]:border-0 [&>.code-block]:shadow-none',
        '[&:not(:has(>.code-block:only-child))]:p-4',
      )}
    >
      {children}
    </div>
  );
}
