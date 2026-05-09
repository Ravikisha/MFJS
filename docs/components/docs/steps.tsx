import * as React from 'react';
import { cn } from '@/lib/utils';

export function Steps({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('steps not-prose', className)}>{children}</div>;
}

export function Step({
  title,
  children,
  active,
}: {
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div className="step" data-active={active ? 'true' : undefined}>
      <h3>{title}</h3>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
