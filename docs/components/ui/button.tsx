import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'gradient';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const VARIANT: Record<ButtonVariant, string> = {
  default:
    'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline:
    'border border-border bg-transparent hover:bg-secondary text-foreground',
  ghost: 'hover:bg-secondary text-foreground',
  link: 'text-accent underline-offset-4 hover:underline',
  gradient:
    'text-white shadow-md shadow-accent/20 bg-[linear-gradient(135deg,hsl(var(--gradient-from)),hsl(var(--gradient-to)))] hover:brightness-110',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-6 text-base rounded-lg',
  icon: 'h-9 w-9 rounded-md',
};

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-[background,color,box-shadow,filter,border-color] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button ref={ref} className={cn(BASE, VARIANT[variant], SIZE[size], className)} {...props} />
    );
  },
);
Button.displayName = 'Button';

export interface ButtonLinkProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  external?: boolean;
}

export function ButtonLink({
  className,
  variant = 'default',
  size = 'md',
  external,
  ...props
}: ButtonLinkProps) {
  const cls = cn(BASE, VARIANT[variant], SIZE[size], className);
  if (external) {
    return (
      <a
        href={String(props.href)}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
      >
        {props.children}
      </a>
    );
  }
  return <Link className={cls} {...props} />;
}
