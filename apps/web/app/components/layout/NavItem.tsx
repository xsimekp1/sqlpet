'use client'

import Link from 'next/link'
import { LucideIcon, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/app/context/AuthContext'
import { userHasPermission } from '@/app/lib/permissions'
import { motion } from 'framer-motion'

interface NavItemProps {
  href: string
  icon: LucideIcon
  label: string
  collapsed?: boolean
  permission?: string | null
  isSuperadminOnly?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  isActive?: boolean
  isHovered?: boolean
}

export function NavItem({ href, icon: Icon, label, collapsed = false, permission = null, isSuperadminOnly = false, onMouseEnter, onMouseLeave, isActive = false, isHovered = false }: NavItemProps) {
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
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
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
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative',
        collapsed && 'justify-center px-2'
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {!collapsed && (
        <motion.div
          className={cn(
            "absolute inset-0 bg-accent rounded-lg -z-10",
          )}
          initial={false}
          animate={{ 
            opacity: isActive || isHovered ? 1 : 0,
            scale: isActive || isHovered ? 1 : 0.95
          }}
          transition={{ duration: 0.15 }}
        />
      )}
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
  )
}
