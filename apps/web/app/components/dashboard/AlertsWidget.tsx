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
    >
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold">{unacknowledged}</p>
          <p className="text-sm text-muted-foreground">{t('unacknowledged')}</p>
        </div>

        {unacknowledged > 0 && (
          <div className="space-y-1 text-sm">
            <div className="text-destructive">• Critical: Health check needed</div>
            <div className="text-orange-600 dark:text-orange-400">• Warning: Low food stock</div>
          </div>
        )}

        <Link href="/dashboard/alerts">
          <Button variant="link" size="sm" className="px-0">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
