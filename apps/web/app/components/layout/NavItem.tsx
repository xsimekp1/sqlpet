'use client'

import Link from 'next/link'
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
  isSuperadminOnly?: boolean
  isActive?: boolean
}

export function NavItem({ href, icon: Icon, label, collapsed = false, permission = null, isSuperadminOnly = false, isActive = false }: NavItemProps) {
  const t = useTranslations()
  const { user, permissions } = useAuth()
  
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
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative',
        collapsed && 'justify-center px-2'
      )}
    >
      {!collapsed && (
        <div
          className={cn(
            "absolute inset-0 rounded-lg -z-10",
            isActive ? "bg-accent" : "bg-muted group-hover:bg-muted-foreground/20"
          )}
        />
      )}
      <Icon className="h-5 w-5 shrink-0 z-10" />
      {!collapsed && (
        <span className={cn("truncate z-10", isActive && "font-medium")}>{t(label)}</span>
      )}
      {!collapsed && isSuperadminOnly && (
        <span className="ml-auto text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full z-10" title="Superadmin">
          S
        </span>
      )}
    </Link>
  )
}
