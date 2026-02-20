'use client';

import { useEffect, useState } from 'react';

export type Theme = 'teal' | 'berry' | 'safari';

const THEME_KEY = 'sqlpet_theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'teal';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'teal' || stored === 'berry' || stored === 'safari') return stored;
  return 'teal';
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void; mounted: boolean } {
  const [theme, setThemeState] = useState<Theme>('teal');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    setStoredTheme(newTheme);
    applyTheme(newTheme);
  };

  return { theme, setTheme, mounted };
}
