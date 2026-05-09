import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'info' | 'warn' | 'danger' | 'success';

const ICON: Record<Variant, React.ReactNode> = {
  info: (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </svg>
  ),
  warn: (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  danger: (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  ),
};

const ICON_COLOR: Record<Variant, string> = {
  info: 'text-accent',
  warn: 'text-amber-500',
  danger: 'text-destructive',
  success: 'text-emerald-500',
};

export function Callout({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: Variant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('callout-root', className)} data-variant={variant} role="note">
      <span className={cn('callout-icon', ICON_COLOR[variant])} aria-hidden>
        {ICON[variant]}
      </span>
      <div className="callout-body">
        {title && <p className="font-semibold not-italic">{title}</p>}
        <div className="text-sm text-foreground/90">{children}</div>
      </div>
    </div>
  );
}
