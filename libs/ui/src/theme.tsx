import { createContext, useContext, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface Theme {
  colorPrimary: string;
  colorOnPrimary: string;
  colorSurface: string;
  colorOnSurface: string;
  colorBorder: string;
  radiusMd: string;
}

export const defaultTheme: Theme = {
  colorPrimary: '#4f46e5',
  colorOnPrimary: '#ffffff',
  colorSurface: '#ffffff',
  colorOnSurface: '#111827',
  colorBorder: '#d1d5db',
  radiusMd: '6px',
};

const ThemeCtx = createContext<Theme>(defaultTheme);

export function useTheme(): Theme {
  return useContext(ThemeCtx);
}

export interface ThemeProviderProps {
  theme?: Partial<Theme>;
  children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const merged = useMemo<Theme>(() => ({ ...defaultTheme, ...theme }), [theme]);
  const cssVars: CSSProperties & Record<string, string> = {
    '--jorvel-color-primary': merged.colorPrimary,
    '--jorvel-color-on-primary': merged.colorOnPrimary,
    '--jorvel-color-surface': merged.colorSurface,
    '--jorvel-color-on-surface': merged.colorOnSurface,
    '--jorvel-color-border': merged.colorBorder,
    '--jorvel-radius-md': merged.radiusMd,
  };
  return (
    <ThemeCtx.Provider value={merged}>
      <div style={cssVars}>{children}</div>
    </ThemeCtx.Provider>
  );
}
