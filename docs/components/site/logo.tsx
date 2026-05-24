import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5 group', className)}>
      <span
        aria-hidden
        className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(135deg,hsl(var(--gradient-from)),hsl(var(--gradient-to)))] text-white shadow-md shadow-accent/30"
      >
        <svg viewBox="40 70 240 190" width={18} height={18} fill="none" aria-hidden>
          <g stroke="currentColor" strokeWidth={10} strokeLinecap="round">
            <line x1="70" y1="240" x2="70" y2="90" />
            <line x1="70" y1="90" x2="160" y2="200" />
            <line x1="160" y1="200" x2="250" y2="90" />
            <line x1="250" y1="90" x2="250" y2="240" />
          </g>
          <g fill="currentColor">
            <circle cx="70" cy="90" r="14" />
            <circle cx="250" cy="90" r="14" />
            <circle cx="70" cy="240" r="14" />
            <circle cx="250" cy="240" r="14" />
          </g>
          <circle cx="160" cy="200" r="18" fill="#a3e635" />
        </svg>
        <span className="absolute inset-0 rounded-lg ring-1 ring-white/20" />
      </span>
      {withWordmark && (
        <span className="flex items-baseline gap-1.5 text-sm">
          <span className="font-semibold tracking-tight">JORVEL</span>
          <span className="hidden sm:inline rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            v0.2.0
          </span>
        </span>
      )}
    </Link>
  );
}

