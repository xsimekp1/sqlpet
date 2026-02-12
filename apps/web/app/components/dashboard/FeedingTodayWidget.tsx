'use client'

import { Bone, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ApiClient } from '@/lib/api'
import { useOrganizationStore } from '@/store/organizationStore'

interface FeedingTodayWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function FeedingTodayWidget({ editMode, onRemove, dragHandleProps }: FeedingTodayWidgetProps) {
  const t = useTranslations('dashboard')
  const { selectedOrg } = useOrganizationStore()

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]

  // Fetch pending feeding tasks for today
  const { data: pendingTasks } = useQuery({
    queryKey: ['tasks', 'feeding-pending', selectedOrg?.id, today],
    queryFn: () =>
      ApiClient.getTasks({
        type: 'feeding',
        status: 'pending',
        due_date: today,
      }),
    enabled: !!selectedOrg?.id,
  })

  // Fetch completed feeding tasks for today
  const { data: completedTasks } = useQuery({
    queryKey: ['tasks', 'feeding-completed', selectedOrg?.id, today],
    queryFn: () =>
      ApiClient.getTasks({
        type: 'feeding',
        status: 'completed',
        due_date: today,
      }),
    enabled: !!selectedOrg?.id,
  })

  const animalsPending = pendingTasks?.items?.length || 0
  const completed = completedTasks?.items?.length || 0
  const total = animalsPending + completed

  const progressPercentage = total > 0 ? (completed / total) * 100 : 0

  return (
    <WidgetCard
      id="feeding-today"
      title={t('feedingToday')}
      icon={Bone}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200/50 dark:border-green-800/30"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
            <Bone className="h-6 w-6 text-green-600 dark:text-green-400" />
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

        <Link href="/dashboard/tasks?type=feeding">
          <Button variant="link" size="sm" className="px-0 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
