'use client';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { MoonIcon, SunIcon } from '@/components/icons';

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}

export function NoFlashScript() {
  // Inline script — runs before first paint to set the `dark` class so theme
  // tokens apply immediately and the page does not flash.
  const code = `
    (function() {
      try {
        var t = localStorage.getItem('jorvel-theme') || 'system';
        var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var resolved = t === 'system' ? (d ? 'dark' : 'light') : t;
        if (resolved === 'dark') document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = resolved;
      } catch (_) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} suppressHydrationWarning />;
}
