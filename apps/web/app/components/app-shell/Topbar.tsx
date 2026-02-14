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
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-gradient-to-r from-primary/8 via-background/95 to-background/95 backdrop-blur supports-[backdrop-filter]:from-primary/5">
      <div className="flex h-16 items-center justify-between px-4 gap-4">
        {/* Left: Menu toggle (mobile) + Org Switcher */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <OrgSwitcher />
        </div>

        {/* Center: Global Search */}
        <div className="flex-1 max-w-xl">
          <GlobalSearchTrigger />
        </div>

        {/* Right: Alerts, Language, User */}
        <div className="flex items-center gap-2">
          <AlertsBell />
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
