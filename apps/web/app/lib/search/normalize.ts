/**
 * Text normalization utilities for search
 *
 * Normalizes text by:
 * - Converting to lowercase
 * - Removing diacritics (Czech: á→a, č→c, etc.)
 * - Trimming whitespace
 */

const DIACRITICS_MAP: Record<string, string> = {
  'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
  'č': 'c', 'ć': 'c', 'ç': 'c',
  'ď': 'd', 'đ': 'd',
  'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e', 'ę': 'e', 'ě': 'e',
  'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
  'ľ': 'l', 'ĺ': 'l', 'ł': 'l',
  'ň': 'n', 'ń': 'n', 'ñ': 'n',
  'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o', 'ø': 'o',
  'ř': 'r', 'ŕ': 'r',
  'š': 's', 'ś': 's', 'ş': 's',
  'ť': 't', 'ţ': 't',
  'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u', 'ů': 'u', 'ų': 'u',
  'ý': 'y', 'ÿ': 'y',
  'ž': 'z', 'ź': 'z', 'ż': 'z',
}

/**
 * Remove diacritics from text
 * Example: "očkování" → "ockovani"
 */
export function removeDiacritics(text: string): string {
  return text
    .split('')
    .map(char => DIACRITICS_MAP[char] || char)
    .join('')
}

/**
 * Normalize text for search
 * Example: "Očkování Zvířat" → "ockovani zvirat"
 */
export function normalizeText(text: string): string {
  return removeDiacritics(text.toLowerCase().trim())
}

/**
 * Normalize and split text into tokens
 * Example: "očkování zvířat" → ["ockovani", "zvirat"]
 */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(token => token.length > 0)
}
