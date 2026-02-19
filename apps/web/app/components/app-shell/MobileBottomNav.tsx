'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, PawPrint, Bell, Menu, Footprints } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export function MobileBottomNav() {
  const pathname = usePathname()
  const t = useTranslations('nav')

  const navItems = [
    { href: '/dashboard', icon: Home, label: t('dashboard') },
    { href: '/dashboard/animals', icon: PawPrint, label: t('animals') },
    { href: '/dashboard/walk-mode', icon: Footprints, label: t('walkMode'), disabled: true },
    { href: '/dashboard/alerts', icon: Bell, label: t('alerts') },
    { href: '/dashboard/menu', icon: Menu, label: t('menu') },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.disabled ? '#' : item.href}
              onClick={(e) => item.disabled && e.preventDefault()}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:text-primary',
                isActive && !item.disabled ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && !item.disabled && 'fill-current')} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
