'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/site/logo';
import { SearchTrigger } from '@/components/site/search-trigger';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button, ButtonLink } from '@/components/ui/button';
import { GitHubIcon, MenuIcon, XIcon } from '@/components/icons';
import { DOC_NAV } from '@/app/docs/nav';
import { cn } from '@/lib/utils';

const PRIMARY_NAV = [
  { href: '/docs/getting-started', label: 'Docs' },
  { href: '/docs/cli', label: 'CLI' },
  { href: '/docs/api/runtime', label: 'API' },
  { href: '/docs/deployment', label: 'Deploy' },
];

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition',
                  active
                    ? 'text-foreground bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex flex-1 items-center justify-end gap-2 lg:flex-initial">
          <SearchTrigger className="hidden md:inline-flex" />
          <ButtonLink
            href="https://github.com/moxjs/moxjs"
            external
            variant="ghost"
            size="icon"
            aria-label="GitHub"
          >
            <GitHubIcon />
          </ButtonLink>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </div>
      {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} />}
    </header>
  );
}

function MobileNav({ onClose }: { onClose: () => void }) {
  return (
    <div className="border-t border-border bg-background lg:hidden">
      <div className="px-4 py-4 sm:px-6">
        <SearchTrigger />
        <nav className="mt-4 grid grid-cols-2 gap-2" aria-label="Primary mobile">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="rounded-md border border-border bg-secondary/60 px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 max-h-[60vh] space-y-5 overflow-y-auto">
          {DOC_NAV.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <ul className="mt-2 space-y-1">
                {section.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={onClose}
                      className="block rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
