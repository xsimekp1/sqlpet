'use client'

import Link from 'next/link'
import { LucideIcon, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/app/context/AuthContext'
import { userHasPermission } from '@/app/lib/permissions'
import { useRef } from 'react'

interface NavItemProps {
  href: string
  icon: LucideIcon
  label: string
  collapsed?: boolean
  permission?: string | null
  isSuperadminOnly?: boolean
  isActive?: boolean
  onHoverStart?: (bounds: DOMRect) => void
  onHoverEnd?: () => void
}

export function NavItem({
  href,
  icon: Icon,
  label,
  collapsed = false,
  permission = null,
  isSuperadminOnly = false,
  isActive = false,
  onHoverStart,
  onHoverEnd
}: NavItemProps) {
  const t = useTranslations()
  const { user, permissions } = useAuth()
  const itemRef = useRef<HTMLDivElement>(null)

  const hasPermission = userHasPermission(user, permission, permissions)
  const isDisabled = permission !== null && !hasPermission

  const handleMouseEnter = () => {
    if (itemRef.current && onHoverStart) {
      const bounds = itemRef.current.getBoundingClientRect()
      onHoverStart(bounds)
    }
  }

  const handleMouseLeave = () => {
    if (onHoverEnd) {
      onHoverEnd()
    }
  }

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
    <div
      ref={itemRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative"
    >
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 relative z-10',
          collapsed && 'justify-center px-2',
          isActive && 'bg-accent font-medium'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <span className={cn("truncate", isActive && "font-medium")}>{t(label)}</span>
        )}
        {!collapsed && isSuperadminOnly && (
          <span className="ml-auto text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full" title="Superadmin">
            S
          </span>
        )}
      </Link>
    </div>
  )
}
