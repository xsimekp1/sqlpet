export const DEFAULT_SHORTCUTS: Record<string, string> = {
  open_search: 'ctrl+k',
  open_animals: 'ctrl+shift+a',
  open_kennels: 'ctrl+shift+k',
  open_tasks: 'ctrl+shift+t',
  open_inventory: 'ctrl+shift+i',
  open_feeding: 'ctrl+shift+f',
};

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

/**
 * Format a key combo for display, e.g. 'ctrl+shift+a' → 'Ctrl+Shift+A' (or ⌘+Shift+A on Mac)
 */
export function formatShortcut(combo: string): string {
  return combo
    .split('+')
    .map(part => {
      switch (part.toLowerCase()) {
        case 'ctrl':  return isMac ? '⌘' : 'Ctrl';
        case 'shift': return 'Shift';
        case 'alt':   return isMac ? '⌥' : 'Alt';
        default:      return part.toUpperCase();
      }
    })
    .join('+');
}

/**
 * Parse a KeyboardEvent into a normalized combo string like 'ctrl+shift+a'
 */
export function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = e.key.toLowerCase();
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) parts.push(key);
  return parts.join('+');
}
