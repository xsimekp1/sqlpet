'use client';

import { useEffect, useState } from 'react';

export type Theme = 'teal' | 'berry';

const THEME_KEY = 'sqlpet_theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'teal';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'teal' || stored === 'berry') return stored;
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

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('teal');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  const toggleTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    setStoredTheme(newTheme);
    applyTheme(newTheme);
  };

  return { theme, setTheme: toggleTheme, mounted };
}
