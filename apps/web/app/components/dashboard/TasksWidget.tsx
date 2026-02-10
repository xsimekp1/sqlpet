'use client'

import { CheckSquare, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface TasksWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function TasksWidget({ editMode, onRemove, dragHandleProps }: TasksWidgetProps) {
  const t = useTranslations('dashboard')

  // TODO: Fetch real data from API in M3+
  const tasksDue = 5
  const highPriority = 2

  return (
    <WidgetCard
      id="tasks"
      title={t('tasks')}
      icon={CheckSquare}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-800/30"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <CheckSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-4xl font-bold text-blue-700 dark:text-blue-400">{tasksDue}</p>
            <p className="text-sm text-muted-foreground">{t('tasksDue')}</p>
          </div>
        </div>

        {highPriority > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            <span className="text-sm text-orange-700 dark:text-orange-400 font-medium">
              {highPriority} high priority
            </span>
          </div>
        )}

        <Link href="/dashboard/tasks">
          <Button variant="link" size="sm" className="px-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
