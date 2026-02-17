'use client'

import { useRef } from 'react'
import {
  Home,
  PawPrint,
  Grid3x3,
  HeartPulse,
  Bone,
  CheckSquare,
  Users,
  BarChart3,
  Settings,
  Inbox,
  Heart,
  ChevronLeft,
  Package,
  HelpCircle,
  CalendarDays,
  Camera,
  Zap,
  Loader2,
  MessageSquare,
  Hotel,
  Footprints,
} from 'lucide-react'
import { NavItem } from '../layout/NavItem'
import { useAuth } from '@/app/context/AuthContext'
import { filterNavByPermissions } from '@/app/lib/permissions'
import { useUIStore } from '@/app/stores/uiStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from '@/app/lib/api'
import { useState } from 'react'
import { toast } from 'sonner'
import Image from 'next/image'

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
  const { user, permissions } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const t = useTranslations()
  const queryClient = useQueryClient()
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const { data: orgInfo } = useQuery({
    queryKey: ['org-info'],
    queryFn: () => ApiClient.getOrganizationInfo(),
    staleTime: 5 * 60 * 1000,
  })

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      await ApiClient.uploadOrgLogo(file)
      queryClient.invalidateQueries({ queryKey: ['org-info'] })
      toast.success('Logo updated')
    } catch {
      toast.error('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

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
        { label: 'nav.hotel', href: '/dashboard/hotel/reservations', icon: Hotel, permission: 'kennels.view' },
        { label: 'nav.walks', href: '/dashboard/walks', icon: Footprints, permission: 'tasks.view' },
        { label: 'nav.medical', href: '/dashboard/medical', icon: HeartPulse, permission: 'medical.view' },
        { label: 'nav.feeding', href: '/dashboard/feeding', icon: Bone, permission: 'feeding.view' },
        { label: 'nav.inventory', href: '/dashboard/inventory', icon: Package, permission: 'inventory.view' },
        { label: 'nav.tasks', href: '/dashboard/tasks', icon: CheckSquare, permission: 'tasks.view' },
        { label: 'nav.calendar', href: '/dashboard/calendar', icon: CalendarDays, permission: null },
      ]
    },
    {
      title: 'nav.people',
      items: [
        { label: 'nav.people', href: '/dashboard/people', icon: Users, permission: 'people.view' },
        { label: 'nav.chat', href: '/dashboard/chat', icon: MessageSquare, permission: 'chat.use' },
        { label: 'nav.adoptions', href: '/dashboard/adoptions', icon: Heart, permission: 'adoptions.view' },
      ]
    },
    {
      title: 'nav.system',
      items: [
        { label: 'nav.intake', href: '/dashboard/intake', icon: Inbox, permission: 'intake.create' },
        { label: 'nav.reports', href: '/dashboard/reports', icon: BarChart3, permission: 'reports.view' },
        { label: 'nav.settings', href: '/dashboard/settings', icon: Settings, permission: 'settings.view' },
        { label: 'nav.performance', href: '/dashboard/settings/performance', icon: Zap, permission: 'metrics.read' },
        { label: 'nav.help', href: '/dashboard/help', icon: HelpCircle, permission: null },
      ]
    }
  ]

  // Show all nav items - filterNavByPermissions only used for disabled state
  const filteredSections = navSections.map(section => ({
    ...section,
    items: section.items
  })).filter(section => section.items.length > 0)

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r bg-card transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo / Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {/* Hidden file input (shared) */}
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Org logo — hover to upload */}
            <div className="relative group shrink-0 cursor-pointer" onClick={() => logoInputRef.current?.click()}>
              {orgInfo?.logo_url ? (
                <img src={orgInfo.logo_url} alt="logo" className="h-8 w-8 rounded-md object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <PawPrint className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="absolute inset-0 rounded-md bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingLogo ? <Loader2 className="h-3 w-3 text-white animate-spin" /> : <Camera className="h-3 w-3 text-white" />}
              </div>
            </div>
            {orgInfo?.logo_url ? (
              <span className="font-bold text-lg truncate">{orgInfo.name}</span>
            ) : (
              <Image src="/petslog.png" alt="Petslog" width={100} height={27} className="object-contain" priority />
            )}
          </div>
        )}
        {sidebarCollapsed && (
          <div className="relative group mx-auto cursor-pointer" onClick={() => logoInputRef.current?.click()}>
            {orgInfo?.logo_url ? (
              <img src={orgInfo.logo_url} alt="logo" className="h-8 w-8 rounded-md object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <PawPrint className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="absolute inset-0 rounded-md bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingLogo ? <Loader2 className="h-3 w-3 text-white animate-spin" /> : <Camera className="h-3 w-3 text-white" />}
            </div>
          </div>
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
                  permission={item.permission}
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
