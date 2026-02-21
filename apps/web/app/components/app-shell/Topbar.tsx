'use client'

import { Menu, Settings } from 'lucide-react'
import Link from 'next/link'
import { OrgSwitcher } from './OrgSwitcher'
import { GlobalSearchTrigger } from '../layout/GlobalSearchTrigger'
import { AlertsBell } from '../layout/AlertsBell'
import { UserMenu } from '../layout/UserMenu'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/app/stores/uiStore'
import { WeatherWidget } from './WeatherWidget'
import { EasterEggTrigger } from '../easter-egg/EasterEggTrigger'

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

        {/* Center: Global Search + Weather */}
        <div className="flex-1 flex items-center justify-end gap-4 max-w-xl">
          <div className="hidden lg:block">
            <WeatherWidget />
          </div>
          <GlobalSearchTrigger className="text-slate-300" />
        </div>

        {/* Right: Settings, Alerts, Language, User */}
        <div className="flex items-center gap-1 text-slate-200">
          <Link href="/dashboard/settings">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:text-white hover:bg-slate-700"
              title="Nastavení"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <AlertsBell />
          <div className="hidden md:flex">
            <LanguageSwitcher />
          </div>
          <UserMenu />
          <EasterEggTrigger />
        </div>
      </div>
    </header>
  )
}
