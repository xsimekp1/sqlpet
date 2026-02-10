'use client'

import { Apple, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface FeedingTodayWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function FeedingTodayWidget({ editMode, onRemove, dragHandleProps }: FeedingTodayWidgetProps) {
  const t = useTranslations('dashboard')

  // TODO: Fetch real data from API in M3+
  const animalsPending = 12
  const completed = 8
  const total = animalsPending + completed

  return (
    <WidgetCard
      id="feeding-today"
      title={t('feedingToday')}
      icon={Apple}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
    >
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold">{animalsPending}</p>
          <p className="text-sm text-muted-foreground">{t('animalsPending')}</p>
        </div>

        <div className="text-sm text-muted-foreground">
          {completed}/{total} completed today
        </div>

        <Link href="/dashboard/feeding">
          <Button variant="link" size="sm" className="px-0">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
