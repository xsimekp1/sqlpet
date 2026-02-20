'use client'

import Link from 'next/link'
import { LucideIcon, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/app/context/AuthContext'
import { userHasPermission } from '@/app/lib/permissions'
import { useRef } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatShortcut } from '@/app/lib/shortcuts'
import { useShortcutHint } from '@/app/hooks/useShortcutHint'

const ACTION_KEY_MAP: Record<string, { actionKey: string; label: string; shortcut: string }> = {
  '/dashboard/animals': { actionKey: 'animals', label: 'Zvířata', shortcut: 'Ctrl+Shift+A' },
  '/dashboard/kennels': { actionKey: 'kennels', label: 'Kotce', shortcut: 'Ctrl+Shift+K' },
  '/dashboard/tasks': { actionKey: 'tasks', label: 'Úkoly', shortcut: 'Ctrl+Shift+T' },
  '/dashboard/inventory': { actionKey: 'inventory', label: 'Sklad', shortcut: 'Ctrl+Shift+I' },
  '/dashboard/feeding': { actionKey: 'feeding', label: 'Krmení', shortcut: 'Ctrl+Shift+F' },
}

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
  onNavigate?: () => void
  shortcut?: string
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
  onHoverEnd,
  onNavigate,
  shortcut
}: NavItemProps) {
  const t = useTranslations()
  const { user, permissions } = useAuth()
  const itemRef = useRef<HTMLDivElement>(null)

  const actionConfig = ACTION_KEY_MAP[href]
  const { trackClick } = useShortcutHint({
    actionKey: actionConfig?.actionKey || '',
    shortcut: actionConfig?.shortcut || '',
    label: actionConfig?.label || '',
    message: actionConfig ? t('shortcuts.hintMessage', { label: actionConfig.label, shortcut: actionConfig.shortcut }) : undefined,
    threshold: 3,
    windowMs: 60000,
  })

  const hasPermission = userHasPermission(user, permission, permissions)
  const isDisabled = permission !== null && !hasPermission

  const handleClick = () => {
    if (actionConfig) {
      trackClick()
    }
    if (onNavigate) {
      onNavigate()
    }
  }

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

  const navLink = (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 relative z-10',
        collapsed && 'justify-center px-2',
        isActive && 'bg-accent font-medium'
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 transition-colors hover:text-blue-600 dark:hover:text-blue-400")} />
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

  if (isDisabled) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-not-allowed opacity-50',
          collapsed && 'justify-center px-2'
        )}
        title={t('errors.noPermission')}
      >
      <Icon className={cn("h-5 w-5 shrink-0 transition-colors hover:text-blue-600 dark:hover:text-blue-400")} />
        {!collapsed && <span>{t(label)}</span>}
      </div>
    )
  }

  if (shortcut && collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={itemRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="relative"
          >
            {navLink}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          <span>{t(label)}</span>
          <kbd className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{formatShortcut(shortcut)}</kbd>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div
      ref={itemRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative"
    >
      {navLink}
    </div>
  )
}
