'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon, XIcon } from '@/components/icons';
import { searchDocs, SEARCH_INDEX, type SearchResult } from '@/lib/search-index';
import { cn } from '@/lib/utils';

const DEFAULT_RESULTS: SearchResult[] = SEARCH_INDEX.slice(0, 6).map((e) => ({ ...e, score: 0 }));

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const results = React.useMemo(() => {
    if (!query.trim()) return DEFAULT_RESULTS;
    return searchDocs(query, 12);
  }, [query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Open via ⌘K / Ctrl+K + Esc to close + listen for trigger event
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === '/' && !open) {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
        if (!isEditable) {
          e.preventDefault();
          setOpen(true);
        }
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    function onTriggerOpen() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('moxjs:search-open', onTriggerOpen as EventListener);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('moxjs:search-open', onTriggerOpen as EventListener);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(t);
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function go(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[activeIndex];
      if (hit) go(hit.href);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search docs…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search query"
            aria-controls="search-results"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div
          ref={listRef}
          id="search-results"
          role="listbox"
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              No results for <span className="font-medium text-foreground">{query}</span>
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.href}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                data-idx={i}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => go(r.href)}
                className={cn(
                  'flex w-full flex-col gap-0.5 rounded-md px-3 py-2.5 text-left transition',
                  i === activeIndex
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{r.title}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.section}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground line-clamp-1">{r.description}</span>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border bg-secondary/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↑</kbd>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
