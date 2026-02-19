'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LucideIcon, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/app/context/AuthContext'
import { userHasPermission } from '@/app/lib/permissions'

interface NavItemProps {
  href: string
  icon: LucideIcon
  label: string
  collapsed?: boolean
  permission?: string | null
  onHover?: () => void
  onLeave?: () => void
  isHovered?: boolean
}

export function NavItem({ href, icon: Icon, label, collapsed = false, permission = null, onHover, onLeave, isHovered }: NavItemProps) {
  const pathname = usePathname()
  const t = useTranslations()
  const { user, permissions } = useAuth()
  const isActive = pathname === href || pathname.startsWith(href + '/')
  
  const hasPermission = userHasPermission(user, permission, permissions)
  const isDisabled = permission !== null && !hasPermission

  if (isDisabled) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-not-allowed opacity-50',
          collapsed && 'justify-center px-2'
        )}
        title={t('errors.noPermission')}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{t(label)}</span>}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative z-10',
        isActive && 'bg-accent text-accent-foreground font-medium',
        collapsed && 'justify-center px-2'
      )}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{t(label)}</span>}
    </Link>
  )
}
