'use client'

import { Menu } from 'lucide-react'
import { OrgSwitcher } from './OrgSwitcher'
import { GlobalSearchTrigger } from '../layout/GlobalSearchTrigger'
import { AlertsBell } from '../layout/AlertsBell'
import { UserMenu } from '../layout/UserMenu'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/app/stores/uiStore'

export function Topbar() {
  const { toggleSidebar } = useUIStore()

  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 text-slate-200">
      <div className="flex h-16 items-center justify-between px-4 gap-4">
        {/* Left: Menu toggle (mobile) + Org Switcher */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-200 hover:text-white hover:bg-slate-700"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <OrgSwitcher />
        </div>

        {/* Center: Global Search */}
        <div className="flex-1 max-w-xl">
          <GlobalSearchTrigger className="text-slate-300" />
        </div>

        {/* Right: Alerts, Language, User */}
        <div className="flex items-center gap-2 text-slate-200">
          <AlertsBell />
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
