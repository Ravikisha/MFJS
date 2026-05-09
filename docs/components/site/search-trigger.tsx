'use client';

import { Kbd } from '@/components/ui/kbd';
import { SearchIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Visual-only search trigger. Hooking up a real index (Algolia DocSearch,
 * Pagefind, or Orama) is left as a follow-up — opening the trigger today
 * focuses the URL bar fallback.
 */
export function SearchTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const event = new CustomEvent('mfjs:search-open');
        window.dispatchEvent(event);
      }}
      className={cn(
        'group inline-flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-border bg-secondary/60 px-3 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground',
        className,
      )}
    >
      <SearchIcon className="h-4 w-4" />
      <span className="flex-1 text-left">Search docs…</span>
      <span className="hidden items-center gap-1 sm:flex">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
