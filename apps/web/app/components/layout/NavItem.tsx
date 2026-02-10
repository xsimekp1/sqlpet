'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface NavItemProps {
  href: string
  icon: LucideIcon
  label: string
  collapsed?: boolean
}

export function NavItem({ href, icon: Icon, label, collapsed = false }: NavItemProps) {
  const pathname = usePathname()
  const t = useTranslations()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground font-medium',
        collapsed && 'justify-center px-2'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{t(label)}</span>}
    </Link>
  )
}
