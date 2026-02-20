'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { type SearchResult, type MatchReason } from '@/app/lib/search/searchCommands'
import { Search, Tag, Repeat, ChevronRight } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

type SearchResultsProps = {
  results: SearchResult[]
  selectedIndex: number
  onSelect: (result: SearchResult) => void
  onHover: (index: number) => void
  query: string
  locale: 'cs' | 'en'
}

export function SearchResults({
  results,
  selectedIndex,
  onSelect,
  onHover,
  query,
  locale,
}: SearchResultsProps) {
  const t = useTranslations('search')

  if (!query.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Search className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">{t('emptyState')}</p>
        <p className="text-xs mt-2">{t('emptyStateHint')}</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Search className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">{t('noResults')}</p>
        <p className="text-xs mt-2">{t('noResultsHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {t('commands')} ({results.length})
      </div>

      {results.map((result, index) => (
        <CommandItem
          key={result.command.id}
          result={result}
          isSelected={index === selectedIndex}
          onClick={() => onSelect(result)}
          onMouseEnter={() => onHover(index)}
          locale={locale}
        />
      ))}
    </div>
  )
}

type CommandItemProps = {
  result: SearchResult
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
  locale: 'cs' | 'en'
}

function CommandItem({ result, isSelected, onClick, onMouseEnter, locale }: CommandItemProps) {
  const t = useTranslations('search')
  const command = result.command

  // Get icon component
  const IconComponent = command.icon
    ? (LucideIcons as any)[command.icon] || Search
    : Search

  const title = locale === 'cs' ? command.title : command.titleEn
  const description = locale === 'cs' ? command.description : command.descriptionEn

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors
        ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}
      `}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary flex-shrink-0">
        <IconComponent className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{title}</span>
          <MatchReasonBadge matchReason={result.matchReason} locale={locale} />
        </div>
        {description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  )
}

type MatchReasonBadgeProps = {
  matchReason: MatchReason
  locale: 'cs' | 'en'
}

function MatchReasonBadge({ matchReason, locale }: MatchReasonBadgeProps) {
  const t = useTranslations('search.matchReason')

  if (matchReason.type === 'title') {
    return (
      <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
        <Search className="h-2.5 w-2.5" />
        {t('title')}
      </Badge>
    )
  }

  if (matchReason.type === 'keyword') {
    return (
      <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
        <Tag className="h-2.5 w-2.5" />
        {t('keyword')}
      </Badge>
    )
  }

  if (matchReason.type === 'synonym') {
    return (
      <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
        <Repeat className="h-2.5 w-2.5" />
        {t('synonym')}
      </Badge>
    )
  }

  return null
}
