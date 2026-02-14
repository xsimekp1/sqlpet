'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useUIStore } from '@/app/stores/uiStore'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

export function GlobalSearchTrigger({ className }: { className?: string }) {
  const t = useTranslations('topbar')
  const { searchOpen, setSearchOpen } = useUIStore()

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

  return (
    <>
      <Button
        variant="outline"
        className={`hidden md:flex items-center gap-2 w-full max-w-sm justify-start bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500 hover:text-white transition-colors${className ? ` ${className}` : ''}`}
        onClick={() => setSearchOpen(true)}
      >
        <Search className="h-4 w-4 text-slate-400" />
        <span className="flex-1 text-left">{t('search')}</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-500 bg-slate-700 px-1.5 font-mono text-[10px] font-medium text-slate-300 opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-slate-200 hover:text-white hover:bg-slate-700"
        onClick={() => setSearchOpen(true)}
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">{t('search')}</span>
      </Button>

      {/* TODO: Implement search modal in M3+ */}
      {searchOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20"
          onClick={() => setSearchOpen(false)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4">
            <p className="text-muted-foreground text-center">
              Search functionality coming in Milestone 3+
            </p>
          </div>
        </div>
      )}
    </>
  )
}
