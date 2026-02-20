'use client'

import { useRef, useState, useEffect } from 'react'
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
  PlusCircle,
  Building2,
  Search,
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
import { toast } from 'sonner'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

interface NavItemConfig {
  label: string
  href: string
  icon: LucideIcon
  permission?: string | null
  isSuperadminOnly?: boolean
  shortcut?: string
}

interface NavSection {
  title: string
  items: NavItemConfig[]
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, permissions } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const t = useTranslations()
  const queryClient = useQueryClient()
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [hoverBounds, setHoverBounds] = useState<{ top: number; height: number } | null>(null)

  // Clear hover indicator when scrolling for better UX
  useEffect(() => {
    const navElement = navRef.current
    if (!navElement) return

    const handleScroll = () => {
      setHoverBounds(null)
    }

    navElement.addEventListener('scroll', handleScroll)
    return () => navElement.removeEventListener('scroll', handleScroll)
  }, [])

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
        { label: 'nav.animals', href: '/dashboard/animals', icon: PawPrint, permission: 'animals.read', shortcut: 'ctrl+shift+a' },
        { label: 'nav.findings', href: '/dashboard/findings', icon: Search, permission: 'animals.read' },
      ]
    },
    {
      title: 'nav.operations',
      items: [
        { label: 'nav.kennels', href: '/dashboard/kennels', icon: Grid3x3, permission: 'kennels.read', shortcut: 'ctrl+shift+k' },
        { label: 'nav.hotel', href: '/dashboard/hotel/reservations', icon: Hotel, permission: 'kennels.read' },
        { label: 'nav.walks', href: '/dashboard/walks', icon: Footprints, permission: 'walks.read' },
        { label: 'nav.medical', href: '/dashboard/medical', icon: HeartPulse, permission: 'medical.read' },
        { label: 'nav.feeding', href: '/dashboard/feeding', icon: Bone, permission: 'feeding.read', shortcut: 'ctrl+shift+f' },
        { label: 'nav.inventory', href: '/dashboard/inventory', icon: Package, permission: 'inventory.read', shortcut: 'ctrl+shift+i' },
        { label: 'nav.tasks', href: '/dashboard/tasks', icon: CheckSquare, permission: 'tasks.read', shortcut: 'ctrl+shift+t' },
        { label: 'nav.calendar', href: '/dashboard/calendar', icon: CalendarDays, permission: null },
      ]
    },
    {
      title: 'nav.people',
      items: [
        { label: 'nav.people', href: '/dashboard/people', icon: Users, permission: 'people.read' },
        { label: 'nav.adoptions', href: '/dashboard/adoptions', icon: Heart, permission: 'adoptions.read' },
      ]
    },
    {
      title: 'nav.system',
      items: [
        { label: 'nav.intake', href: '/dashboard/intake', icon: Inbox, permission: 'intakes.write' },
        { label: 'nav.reports', href: '/dashboard/reports', icon: BarChart3, permission: 'reports.run' },
        // Settings moved to topbar header
        ...(user?.is_superadmin ? [{ label: 'nav.newOrg', href: '/dashboard/new-org', icon: PlusCircle, permission: null, isSuperadminOnly: true }] : []),
        ...(user?.is_superadmin ? [{ label: 'nav.organizationSettings', href: '/dashboard/settings/organization', icon: Building2, permission: null, isSuperadminOnly: true }] : []),
        ...(user?.is_superadmin ? [{ label: 'nav.performance', href: '/dashboard/settings/performance', icon: Zap, permission: null, isSuperadminOnly: true }] : []),
        ...(user?.is_superadmin ? [{ label: 'nav.registeredShelters', href: '/dashboard/admin/registered-shelters', icon: Building2, permission: null, isSuperadminOnly: true }] : []),
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
    <>
      {/* Mobile overlay backdrop */}
      {!sidebarCollapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Mobile: fixed overlay, slide in from left
          'fixed lg:relative inset-y-0 left-0 z-50',
          'flex flex-col border-r bg-card transition-all duration-300',
          // Mobile visibility
          'lg:flex',
          sidebarCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0',
          // Desktop width
          'w-64 lg:w-auto',
          !sidebarCollapsed && 'lg:w-64',
          sidebarCollapsed && 'lg:w-16'
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
      <nav ref={navRef} className="flex-1 overflow-y-auto p-4 space-y-6 relative">
        {/* Global animated hover indicator */}
        <AnimatePresence>
          {hoverBounds && (
            <motion.div
              layoutId="nav-hover-indicator"
              className="absolute left-4 right-4 bg-accent/50 rounded-lg pointer-events-none"
              style={{
                top: hoverBounds.top,
                height: hoverBounds.height
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.15 },
                layout: {
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }
              }}
            />
          )}
        </AnimatePresence>

        {filteredSections.map((section, idx) => (
          <div key={section.title}>
            {idx > 0 && <Separator className="my-4" />}

            {!sidebarCollapsed && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                {t(section.title)}
              </p>
            )}

            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    collapsed={sidebarCollapsed}
                    permission={item.permission}
                    isSuperadminOnly={item.isSuperadminOnly}
                    shortcut={item.shortcut}
                    isActive={isActive}
                    onHoverStart={(bounds) => {
                      if (navRef.current) {
                        const navRect = navRef.current.getBoundingClientRect()
                        setHoverBounds({
                          top: bounds.top - navRect.top + navRef.current.scrollTop,
                          height: bounds.height
                        })
                      }
                    }}
                    onHoverEnd={() => setHoverBounds(null)}
                    onNavigate={() => {
                      // Close sidebar on mobile after navigation
                      if (window.innerWidth < 1024) {
                        toggleSidebar()
                      }
                    }}
                  />
                )
              })}
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
    </>
  )
}
