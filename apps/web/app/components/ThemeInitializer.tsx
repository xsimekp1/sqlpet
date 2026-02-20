'use client';

import { useEffect } from 'react';
import { applyTheme } from '@/app/hooks/useTheme';

export function ThemeInitializer() {
  useEffect(() => {
    // Apply theme on client-side mount
    const stored = localStorage.getItem('sqlpet_theme');
    if (stored === 'teal' || stored === 'berry') {
      applyTheme(stored);
    } else {
      applyTheme('teal');
    }
  }, []);

  return null;
}
