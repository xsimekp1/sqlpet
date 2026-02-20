/**
 * Command search logic with synonym support
 */

import { Command, COMMANDS } from './commands'
import { normalizeText } from './normalize'
import { expandWithSynonyms, findCanonical } from './synonyms'

export type MatchReason =
  | { type: 'title' }
  | { type: 'keyword'; keyword: string }
  | { type: 'synonym'; typed: string; canonical: string }

export type SearchResult = {
  command: Command
  matchReason: MatchReason
  score: number  // For future ranking
}

/**
 * Search commands with synonym expansion
 *
 * @param query - User's search query
 * @param locale - Current locale (cs | en)
 * @param permissions - User's permissions (optional, for filtering)
 * @returns Array of matching commands with match reasons
 */
export function searchCommands(
  query: string,
  locale: 'cs' | 'en' = 'cs',
  permissions?: string[]
): SearchResult[] {
  if (!query || query.trim().length === 0) {
    return []
  }

  const normalized = normalizeText(query)
  const expandedTerms = expandWithSynonyms(normalized, locale)
  const results: SearchResult[] = []

  for (const command of COMMANDS) {
    // Check permission filter
    if (command.permission && permissions && !permissions.includes(command.permission)) {
      continue
    }

    const title = normalizeText(locale === 'cs' ? command.title : command.titleEn)
    const keywords = locale === 'cs' ? command.keywords : command.keywordsEn

    // Check title match
    if (title.includes(normalized)) {
      results.push({
        command,
        matchReason: { type: 'title' },
        score: 100,
      })
      continue
    }

    // Check keyword match (direct)
    const directKeywordMatch = keywords.find(kw => kw.includes(normalized))
    if (directKeywordMatch) {
      results.push({
        command,
        matchReason: { type: 'keyword', keyword: directKeywordMatch },
        score: 80,
      })
      continue
    }

    // Check synonym match (expanded terms)
    for (const term of expandedTerms) {
      if (term === normalized) continue // Skip original term (already checked above)

      // Check if expanded term matches title
      if (title.includes(term)) {
        results.push({
          command,
          matchReason: {
            type: 'synonym',
            typed: normalized,
            canonical: findCanonical(normalized, locale),
          },
          score: 60,
        })
        break
      }

      // Check if expanded term matches keywords
      const synonymKeywordMatch = keywords.find(kw => kw.includes(term))
      if (synonymKeywordMatch) {
        results.push({
          command,
          matchReason: {
            type: 'synonym',
            typed: normalized,
            canonical: findCanonical(normalized, locale),
          },
          score: 60,
        })
        break
      }
    }
  }

  // Sort by score (higher first)
  results.sort((a, b) => b.score - a.score)

  return results
}
