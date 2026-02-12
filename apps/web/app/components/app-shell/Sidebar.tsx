'use client'

import {
  Home,
  PawPrint,
  Grid3x3,
  HeartPulse,
  Apple,
  CheckSquare,
  Users,
  BarChart3,
  Settings,
  Inbox,
  Heart,
  ChevronLeft
} from 'lucide-react'
import { NavItem } from '../layout/NavItem'
import { useAuth } from '@/context/AuthContext'
import { filterNavByPermissions } from '@/lib/permissions'
import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface NavItemConfig {
  label: string
  href: string
  icon: LucideIcon
  permission?: string | null
}

interface NavSection {
  title: string
  items: NavItemConfig[]
}

export function Sidebar() {
  const { user } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const t = useTranslations()

  // Define navigation structure
  const navSections: NavSection[] = [
    {
      title: 'nav.main',
      items: [
        { label: 'nav.dashboard', href: '/dashboard', icon: Home, permission: null },
        { label: 'nav.animals', href: '/dashboard/animals', icon: PawPrint, permission: 'animals.view' },
      ]
    },
    {
      title: 'nav.operations',
      items: [
        { label: 'nav.kennels', href: '/dashboard/kennels', icon: Grid3x3, permission: 'kennels.view' },
        { label: 'nav.medical', href: '/dashboard/medical', icon: HeartPulse, permission: 'medical.view' },
        { label: 'nav.feeding', href: '/dashboard/feeding', icon: Apple, permission: 'feeding.view' },
        { label: 'nav.tasks', href: '/dashboard/tasks', icon: CheckSquare, permission: 'tasks.view' },
      ]
    },
    {
      title: 'nav.people',
      items: [
        { label: 'nav.people', href: '/dashboard/people', icon: Users, permission: 'people.view' },
        { label: 'nav.adoptions', href: '/dashboard/adoptions', icon: Heart, permission: 'adoptions.view' },
      ]
    },
    {
      title: 'nav.system',
      items: [
        { label: 'nav.intake', href: '/dashboard/intake', icon: Inbox, permission: 'intake.create' },
        { label: 'nav.reports', href: '/dashboard/reports', icon: BarChart3, permission: 'reports.view' },
        { label: 'nav.settings', href: '/dashboard/settings', icon: Settings, permission: 'settings.view' },
      ]
    }
  ]

  // Filter nav sections by RBAC
  const filteredSections = navSections.map(section => ({
    ...section,
    items: filterNavByPermissions(section.items, user)
  })).filter(section => section.items.length > 0)

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r bg-background transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo / Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <PawPrint className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">PawShelter</span>
          </div>
        )}
        {sidebarCollapsed && (
          <PawPrint className="h-6 w-6 text-primary mx-auto" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {filteredSections.map((section, idx) => (
          <div key={section.title}>
            {idx > 0 && <Separator className="my-4" />}

            {!sidebarCollapsed && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                {t(section.title)}
              </p>
            )}

            <div className="space-y-1">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  collapsed={sidebarCollapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          size={sidebarCollapsed ? 'icon' : 'sm'}
          className={cn('w-full', sidebarCollapsed && 'h-10')}
          onClick={toggleSidebar}
        >
          <ChevronLeft className={cn(
            'h-4 w-4 transition-transform',
            sidebarCollapsed && 'rotate-180'
          )} />
          {!sidebarCollapsed && <span className="ml-2">{t('nav.collapse')}</span>}
        </Button>
      </div>
    </aside>
  )
}
