'use client'

import { Bell, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface AlertsWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function AlertsWidget({ editMode, onRemove, dragHandleProps }: AlertsWidgetProps) {
  const t = useTranslations('dashboard')

  // TODO: Fetch real data from API in M3+
  const unacknowledged = 2

  return (
    <WidgetCard
      id="alerts"
      title={t('alerts')}
      icon={Bell}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/50 dark:border-amber-800/30"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 relative">
            <Bell className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            {unacknowledged > 0 && (
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-4xl font-bold text-amber-700 dark:text-amber-400">{unacknowledged}</p>
            <p className="text-sm text-muted-foreground">{t('unacknowledged')}</p>
          </div>
        </div>

        {unacknowledged > 0 && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30">
              <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400">Critical: Health check needed</span>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30">
              <div className="h-2 w-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
              <span className="text-sm text-orange-700 dark:text-orange-400">Warning: Low food stock</span>
            </div>
          </div>
        )}

        <Link href="/dashboard/alerts">
          <Button variant="link" size="sm" className="px-0 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
