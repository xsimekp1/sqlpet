'use client'

import { Search, PawPrint, Home, User2, Package, Zap } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useUIStore } from '@/app/stores/uiStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ApiClient, { SearchResults } from '@/app/lib/api'
import { searchCommands, type SearchResult } from '@/app/lib/search/searchCommands'
import * as LucideIcons from 'lucide-react'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)

export function GlobalSearchTrigger({ className }: { className?: string }) {
  const t = useTranslations()
  const locale = useLocale() as 'cs' | 'en'
  const { searchOpen, setSearchOpen } = useUIStore()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [commandResults, setCommandResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  // Handle Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(!searchOpen)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen, setSearchOpen])

  // Focus input when modal opens
  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setResults(null)
      setActiveIdx(-1)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [searchOpen])

  // Fetch results when query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults(null)
      setCommandResults([])
      return
    }

    // Search commands (local, instant)
    const cmdResults = searchCommands(debouncedQuery, locale)
    setCommandResults(cmdResults)

    // Search entities (API, async)
    setLoading(true)
    ApiClient.globalSearch(debouncedQuery)
      .then(setResults)
      .catch(() => setResults(null))
      .finally(() => setLoading(false))
  }, [debouncedQuery, locale])

  // Build flat list for keyboard nav
  const flatItems: { href: string; label: string }[] = []
  commandResults.forEach(cr => flatItems.push({ href: cr.command.href, label: locale === 'cs' ? cr.command.title : cr.command.titleEn }))
  if (results) {
    results.animals.forEach(a => flatItems.push({ href: `/dashboard/animals/${a.id}`, label: a.name }))
    results.kennels.forEach(k => flatItems.push({ href: `/dashboard/kennels/${k.id}`, label: k.code }))
    results.contacts.forEach(c => flatItems.push({ href: `/dashboard/people/${c.id}`, label: c.name }))
    results.inventory.forEach(i => flatItems.push({ href: `/dashboard/inventory/items/${i.id}`, label: i.name }))
  }

  const navigate = useCallback((href: string) => {
    setSearchOpen(false)
    router.push(href)
  }, [router, setSearchOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setSearchOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatItems.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    if (e.key === 'Enter' && activeIdx >= 0 && flatItems[activeIdx]) {
      navigate(flatItems[activeIdx].href)
    }
  }

  const hasResults = commandResults.length > 0 || (results && (
    results.animals.length + results.kennels.length + results.contacts.length + results.inventory.length > 0
  ))

  let globalIdx = -1

  return (
    <>
      <Button
        variant="outline"
        className={`hidden md:flex items-center gap-2 w-full max-w-sm justify-start bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500 hover:text-white transition-colors${className ? ` ${className}` : ''}`}
        onClick={() => setSearchOpen(true)}
      >
        <Search className="h-4 w-4 text-slate-400" />
        <span className="flex-1 text-left">{t('topbar.search')}</span>
        <span className="pointer-events-none hidden sm:inline-flex items-center gap-0.5">
          <kbd className="select-none inline-flex h-5 items-center rounded border border-slate-500 bg-slate-700 px-1.5 font-mono text-[10px] font-medium text-slate-300 opacity-100">{isMac ? '⌘' : 'Ctrl'}</kbd>
          <kbd className="select-none inline-flex h-5 items-center rounded border border-slate-500 bg-slate-700 px-1.5 font-mono text-[10px] font-medium text-slate-300 opacity-100">K</kbd>
        </span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-slate-200 hover:text-white hover:bg-slate-700"
        onClick={() => setSearchOpen(true)}
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">{t('topbar.search')}</span>
      </Button>

      {searchOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-background rounded-xl shadow-2xl border w-full max-w-2xl mx-4 overflow-hidden text-foreground"
            onClick={e => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <Input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActiveIdx(-1) }}
                placeholder={t('topbar.search')}
                className="border-0 shadow-none focus-visible:ring-0 text-base p-0 h-auto"
              />
              <kbd className="text-xs text-muted-foreground border rounded px-1">Esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto py-2">
              {!query || query.length < 2 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('search.typing')}</p>
              ) : loading ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('common.loading')}</p>
              ) : !hasResults ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('search.noResults')}</p>
              ) : (
                <>
                  {commandResults.length > 0 && (
                    <div>
                      <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> {t('search.commands')}
                      </p>
                      {commandResults.map(cr => {
                        globalIdx++
                        const idx = globalIdx
                        const cmd = cr.command
                        const title = locale === 'cs' ? cmd.title : cmd.titleEn
                        const IconComponent = cmd.icon ? (LucideIcons as any)[cmd.icon] || Zap : Zap
                        return (
                          <button
                            key={cmd.id}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-muted ${activeIdx === idx ? 'bg-muted font-medium' : ''}`}
                            onClick={() => navigate(cmd.href)}
                          >
                            <IconComponent className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{title}</span>
                            {cr.matchReason.type === 'synonym' && (
                              <span className="text-xs text-purple-600 dark:text-purple-400">🔁</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {results && results.animals.length > 0 && (
                    <div>
                      <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <PawPrint className="h-3.5 w-3.5" /> {t('search.animals')}
                      </p>
                      {results!.animals.map(a => {
                        globalIdx++
                        const idx = globalIdx
                        return (
                          <button
                            key={a.id}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-muted ${activeIdx === idx ? 'bg-muted font-medium' : ''}`}
                            onClick={() => navigate(`/dashboard/animals/${a.id}`)}
                          >
                            <PawPrint className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{a.name}</span>
                            <span className="text-muted-foreground text-xs">#{a.public_code}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {results!.kennels.length > 0 && (
                    <div>
                      <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5" /> {t('search.kennels')}
                      </p>
                      {results!.kennels.map(k => {
                        globalIdx++
                        const idx = globalIdx
                        return (
                          <button
                            key={k.id}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-muted ${activeIdx === idx ? 'bg-muted font-medium' : ''}`}
                            onClick={() => navigate(`/dashboard/kennels/${k.id}`)}
                          >
                            <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{k.code}</span>
                            {k.zone_name && <span className="text-muted-foreground text-xs">{k.zone_name}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {results!.contacts.length > 0 && (
                    <div>
                      <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <User2 className="h-3.5 w-3.5" /> {t('search.contacts')}
                      </p>
                      {results!.contacts.map(c => {
                        globalIdx++
                        const idx = globalIdx
                        return (
                          <button
                            key={c.id}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-muted ${activeIdx === idx ? 'bg-muted font-medium' : ''}`}
                            onClick={() => navigate(`/dashboard/people/${c.id}`)}
                          >
                            <User2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{c.name}</span>
                            {c.email && <span className="text-muted-foreground text-xs">{c.email}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {results!.inventory.length > 0 && (
                    <div>
                      <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" /> {t('search.inventory')}
                      </p>
                      {results!.inventory.map(i => {
                        globalIdx++
                        const idx = globalIdx
                        return (
                          <button
                            key={i.id}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-muted ${activeIdx === idx ? 'bg-muted font-medium' : ''}`}
                            onClick={() => navigate(`/dashboard/inventory/items/${i.id}`)}
                          >
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{i.name}</span>
                            {i.unit && <span className="text-muted-foreground text-xs">{i.category}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
