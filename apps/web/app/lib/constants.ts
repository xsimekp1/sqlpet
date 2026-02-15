// Statuses that mean the animal is no longer physically in the shelter
export const TERMINAL_STATUSES = [
  'adopted',
  'transferred',
  'returned_to_owner',
  'deceased',
  'euthanized',
  'escaped',
] as const;

export type TerminalStatus = typeof TERMINAL_STATUSES[number];

export function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

// Inventory unit options
export const UNIT_OPTIONS = [
  { value: 'can',    label: 'Konzerva / Can',   symbol: '🥫' },
  { value: 'pouch',  label: 'Kapsička / Pouch',  symbol: '📦' },
  { value: 'bag',    label: 'Pytel / Bag',        symbol: '🛍️' },
  { value: 'bottle', label: 'Láhev / Bottle',    symbol: '🍾' },
  { value: 'tablet', label: 'Tableta / Tablet',  symbol: '💊' },
  { value: 'vial',   label: 'Ampule / Vial',     symbol: '💉' },
  { value: 'piece',  label: 'Kus / Piece',        symbol: '●' },
  { value: 'kg',     label: 'Kilogram',           symbol: 'kg' },
  { value: 'g',      label: 'Gram',               symbol: 'g' },
  { value: 'l',      label: 'Litr',               symbol: 'l' },
  { value: 'ml',     label: 'Mililitr',            symbol: 'ml' },
] as const;

export function getUnitSymbol(unit: string | undefined | null): string {
  return UNIT_OPTIONS.find(u => u.value === unit)?.symbol ?? unit ?? '—';
}

export function getUnitLabel(unit: string | undefined | null): string {
  return UNIT_OPTIONS.find(u => u.value === unit)?.label ?? unit ?? '—';
}
