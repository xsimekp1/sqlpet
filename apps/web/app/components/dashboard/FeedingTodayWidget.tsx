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

  const progressPercentage = (completed / total) * 100

  return (
    <WidgetCard
      id="feeding-today"
      title={t('feedingToday')}
      icon={Apple}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200/50 dark:border-green-800/30"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
            <Apple className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-4xl font-bold text-green-700 dark:text-green-400">{animalsPending}</p>
            <p className="text-sm text-muted-foreground">{t('animalsPending')}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-green-700 dark:text-green-400">
              {completed}/{total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-green-100 dark:bg-green-900/30 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <Link href="/dashboard/feeding">
          <Button variant="link" size="sm" className="px-0 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
