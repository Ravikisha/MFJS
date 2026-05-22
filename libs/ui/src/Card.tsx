import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual emphasis — `outline` (default) or `elevated`. */
  variant?: 'outline' | 'elevated';
  /** Internal padding — `sm` / `md` / `lg`. Default: `md`. */
  padding?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  sm: '8px',
  md: '16px',
  lg: '24px',
};

export function Card({ variant = 'outline', padding = 'md', style, children, ...rest }: CardProps): JSX.Element {
  const base: CSSProperties = {
    background: 'var(--moxjs-color-surface, #fff)',
    color: 'var(--moxjs-color-on-surface, #111)',
    borderRadius: 'var(--moxjs-radius-md, 6px)',
    padding: PADDING[padding],
    ...(variant === 'outline'
      ? { border: '1px solid var(--moxjs-color-border, #d1d5db)' }
      : { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }),
    ...style,
  };
  return (
    <div style={base} {...rest}>
      {children}
    </div>
  );
}
