'use client';

import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ApiClient } from '@/app/lib/api';
import { DEFAULT_SHORTCUTS, eventToCombo } from '@/app/lib/shortcuts';

interface ShortcutEntry {
  action: string;
  key_combo: string;
  is_custom: boolean;
}

/**
 * Fetches user shortcuts from the API and merges with defaults.
 * Returns a map of action → key_combo.
 */
export function useShortcutMap(): Record<string, string> {
  const { data } = useQuery<ShortcutEntry[]>({
    queryKey: ['shortcuts'],
    queryFn: () => ApiClient.get('/me/shortcuts'),
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return DEFAULT_SHORTCUTS;

  const map: Record<string, string> = { ...DEFAULT_SHORTCUTS };
  for (const entry of data) {
    map[entry.action] = entry.key_combo;
  }
  return map;
}

/**
 * Registers global keyboard shortcuts.
 * Call once at the app layout level.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const shortcuts = useShortcutMap();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const combo = eventToCombo(e);

      for (const [action, keyCombo] of Object.entries(shortcuts)) {
        if (combo === keyCombo) {
          e.preventDefault();
          switch (action) {
            case 'open_search':
              // Dispatch a custom event that GlobalSearch listens to
              window.dispatchEvent(new CustomEvent('open-global-search'));
              break;
            case 'open_animals':
              router.push('/dashboard/animals');
              break;
            case 'open_kennels':
              router.push('/dashboard/kennels');
              break;
            case 'open_tasks':
              router.push('/dashboard/tasks');
              break;
            case 'open_inventory':
              router.push('/dashboard/inventory');
              break;
            case 'open_feeding':
              router.push('/dashboard/feeding');
              break;
          }
          break;
        }
      }
    },
    [shortcuts, router],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
