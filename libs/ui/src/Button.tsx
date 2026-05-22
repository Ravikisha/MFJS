import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, CSSProperties> = {
  sm: { padding: '4px 8px', fontSize: '0.875rem' },
  md: { padding: '6px 12px', fontSize: '1rem' },
  lg: { padding: '10px 18px', fontSize: '1.125rem' },
};

const variantStyles: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  primary: {
    background: 'var(--moxjs-color-primary, #4f46e5)',
    color: 'var(--moxjs-color-on-primary, #fff)',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'var(--moxjs-color-surface, #fff)',
    color: 'var(--moxjs-color-on-surface, #111)',
    border: '1px solid var(--moxjs-color-border, #d1d5db)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--moxjs-color-on-surface, #111)',
    border: '1px solid transparent',
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant = 'primary', size = 'md', style, type, ...rest },
  ref,
) {
  const merged: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--moxjs-radius-md, 6px)',
    cursor: rest.disabled ? 'not-allowed' : 'pointer',
    opacity: rest.disabled ? 0.6 : 1,
    transition: 'background-color 120ms ease',
    fontWeight: 500,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };
  return (
    <button ref={ref} type={type ?? 'button'} style={merged} {...rest}>
      {children}
    </button>
  );
});
