/**
 * Synonym dictionary for command search
 *
 * Maps user-typed terms to canonical terms
 * Example: "vakcíny" → "očkování"
 */

export type SynonymEntry = {
  canonical: string       // Canonical term (normalized)
  synonyms: string[]      // Alternative terms (normalized)
  locale: 'cs' | 'en'
}

/**
 * Synonym dictionary (MVP)
 *
 * Czech examples:
 * - vakcíny, vakcinace → očkování
 * - pejsci, psi → psi (pes)
 * - kočky, kočičky → kočky
 */
export const SYNONYM_DICTIONARY: SynonymEntry[] = [
  // Medical / Veterinary
  {
    canonical: 'ockovani',
    synonyms: ['vakciny', 'vakcinace', 'imunizace', 'vakcina'],
    locale: 'cs',
  },
  {
    canonical: 'vaccination',
    synonyms: ['vaccine', 'vaccines', 'immunization', 'shot', 'shots'],
    locale: 'en',
  },
  {
    canonical: 'veterinar',
    synonyms: ['doktor', 'zverolek', 'vet'],
    locale: 'cs',
  },
  {
    canonical: 'veterinarian',
    synonyms: ['vet', 'doctor', 'veterinary'],
    locale: 'en',
  },

  // Animals
  {
    canonical: 'pes',
    synonyms: ['pejsek', 'pejsci', 'psi', 'pejsek', 'pesik'],
    locale: 'cs',
  },
  {
    canonical: 'dog',
    synonyms: ['dogs', 'puppy', 'puppies', 'canine'],
    locale: 'en',
  },
  {
    canonical: 'kocka',
    synonyms: ['kocky', 'kocicka', 'kocicky', 'kote', 'kotata'],
    locale: 'cs',
  },
  {
    canonical: 'cat',
    synonyms: ['cats', 'kitty', 'kitten', 'kittens', 'feline'],
    locale: 'en',
  },

  // Inventory
  {
    canonical: 'sklad',
    synonyms: ['inventar', 'zasoby', 'material'],
    locale: 'cs',
  },
  {
    canonical: 'inventory',
    synonyms: ['stock', 'supplies', 'warehouse', 'storage'],
    locale: 'en',
  },
  {
    canonical: 'objednavka',
    synonyms: ['nakup', 'nakupy', 'order', 'purchase'],
    locale: 'cs',
  },
  {
    canonical: 'order',
    synonyms: ['purchase', 'po', 'procurement', 'buy'],
    locale: 'en',
  },

  // Feeding
  {
    canonical: 'krmeni',
    synonyms: ['jidlo', 'krmivo', 'strava', 'zrat'],
    locale: 'cs',
  },
  {
    canonical: 'feeding',
    synonyms: ['food', 'meal', 'diet', 'feed'],
    locale: 'en',
  },

  // Tasks
  {
    canonical: 'ukol',
    synonyms: ['ukoly', 'task', 'tasks', 'todo'],
    locale: 'cs',
  },
  {
    canonical: 'task',
    synonyms: ['tasks', 'todo', 'job', 'assignment'],
    locale: 'en',
  },

  // Reports
  {
    canonical: 'report',
    synonyms: ['reports', 'statistics', 'stats', 'analytics'],
    locale: 'cs',
  },
  {
    canonical: 'report',
    synonyms: ['reports', 'statistics', 'stats', 'analytics', 'data'],
    locale: 'en',
  },
]

/**
 * Expand query with synonyms
 * Returns all terms that should be searched (original + synonyms)
 *
 * Example:
 * expandWithSynonyms("vakciny", "cs") → ["vakciny", "ockovani"]
 */
export function expandWithSynonyms(query: string, locale: 'cs' | 'en'): string[] {
  const expanded = new Set<string>([query])

  for (const entry of SYNONYM_DICTIONARY) {
    if (entry.locale !== locale) continue

    // Check if query matches canonical
    if (entry.canonical === query) {
      entry.synonyms.forEach(syn => expanded.add(syn))
      continue
    }

    // Check if query matches any synonym
    if (entry.synonyms.includes(query)) {
      expanded.add(entry.canonical)
      entry.synonyms.forEach(syn => expanded.add(syn))
    }
  }

  return Array.from(expanded)
}

/**
 * Find canonical term for a query
 * Returns the canonical term if query is a synonym, otherwise returns query
 *
 * Example:
 * findCanonical("vakciny", "cs") → "ockovani"
 */
export function findCanonical(query: string, locale: 'cs' | 'en'): string {
  for (const entry of SYNONYM_DICTIONARY) {
    if (entry.locale !== locale) continue

    if (entry.canonical === query) return entry.canonical
    if (entry.synonyms.includes(query)) return entry.canonical
  }

  return query
}
