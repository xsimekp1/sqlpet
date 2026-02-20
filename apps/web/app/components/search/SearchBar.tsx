'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search, Loader2 } from 'lucide-react'
import { searchCommands, type SearchResult } from '@/app/lib/search/searchCommands'
import { SearchResults } from './SearchResults'

export function SearchBar() {
  const t = useTranslations('search')
  const locale = useLocale() as 'cs' | 'en'
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd+K / Ctrl+K shortcut to open search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSelectedIndex(0)
      return
    }

    setIsSearching(true)

    // Debounce search (150ms)
    const timeoutId = setTimeout(() => {
      // TODO: Get user permissions from auth context
      const searchResults = searchCommands(query, locale)
      setResults(searchResults)
      setSelectedIndex(0)
      setIsSearching(false)
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [query, locale])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        handleSelectResult(results[selectedIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setIsOpen(false)
      }
    },
    [results, selectedIndex]
  )

  const handleSelectResult = (result: SearchResult) => {
    router.push(result.command.href)
    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  const handleClose = () => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setSelectedIndex(0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="flex items-center border-b px-4 py-3">
          {isSearching ? (
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-muted-foreground" />
          )}
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          <SearchResults
            results={results}
            selectedIndex={selectedIndex}
            onSelect={handleSelectResult}
            onHover={(index) => setSelectedIndex(index)}
            query={query}
            locale={locale}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * SearchBarTrigger - Button to trigger search (for TopBar)
 */
export function SearchBarTrigger({ onClick }: { onClick: () => void }) {
  const t = useTranslations('search')

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full sm:w-64"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">{t('placeholder')}</span>
      <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  )
}
