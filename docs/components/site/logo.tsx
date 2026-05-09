import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5 group', className)}>
      <span
        aria-hidden
        className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(135deg,hsl(var(--gradient-from)),hsl(var(--gradient-to)))] text-white shadow-md shadow-accent/30"
      >
        <svg viewBox="0 0 24 24" width={16} height={16} className="text-white">
          <path
            d="M4 18V6l8 6 8-6v12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute inset-0 rounded-lg ring-1 ring-white/20" />
      </span>
      {withWordmark && (
        <span className="flex items-baseline gap-1.5 text-sm">
          <span className="font-semibold tracking-tight">MFJS</span>
          <span className="hidden sm:inline rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            v0.1.0
          </span>
        </span>
      )}
    </Link>
  );
}
