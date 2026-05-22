import { forwardRef } from 'react';
import type { CSSProperties, InputHTMLAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Field size — `sm` / `md` / `lg`. Default: `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** Inline label (rendered as a wrapping label element). */
  label?: string;
  /** Error message — when set, renders in `aria-invalid` style. */
  errorText?: string;
}

const sizes: Record<NonNullable<InputProps['size']>, CSSProperties> = {
  sm: { padding: '4px 8px', fontSize: '0.875rem' },
  md: { padding: '6px 10px', fontSize: '1rem' },
  lg: { padding: '10px 14px', fontSize: '1.125rem' },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', label, errorText, style, ...rest },
  ref,
) {
  const isInvalid = Boolean(errorText) || rest['aria-invalid'] === true;
  const field: CSSProperties = {
    width: '100%',
    borderRadius: 'var(--moxjs-radius-md, 6px)',
    border: `1px solid ${isInvalid ? 'var(--moxjs-color-error, #ef4444)' : 'var(--moxjs-color-border, #d1d5db)'}`,
    background: 'var(--moxjs-color-surface, #fff)',
    color: 'var(--moxjs-color-on-surface, #111)',
    outline: 'none',
    ...sizes[size],
    ...style,
  };
  const input = (
    <input
      ref={ref}
      style={field}
      aria-invalid={isInvalid || undefined}
      {...rest}
    />
  );
  if (!label && !errorText) return input;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label ? <span style={{ fontSize: '0.875rem' }}>{label}</span> : null}
      {input}
      {errorText ? (
        <span role="alert" style={{ color: 'var(--moxjs-color-error, #ef4444)', fontSize: '0.8rem' }}>
          {errorText}
        </span>
      ) : null}
    </label>
  );
});
