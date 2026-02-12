'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useUIStore } from '@/app/stores/uiStore'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

export function GlobalSearchTrigger() {
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
        className="hidden md:flex items-center gap-2 text-muted-foreground w-64 justify-start"
        onClick={() => setSearchOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">{t('search')}</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
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
