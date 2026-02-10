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
    >
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold">{tasksDue}</p>
          <p className="text-sm text-muted-foreground">{t('tasksDue')}</p>
        </div>

        {highPriority > 0 && (
          <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">
            {highPriority} high priority
          </div>
        )}

        <Link href="/dashboard/tasks">
          <Button variant="link" size="sm" className="px-0">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
