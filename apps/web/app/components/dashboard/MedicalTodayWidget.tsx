'use client'

import { HeartPulse, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import ApiClient from '@/app/lib/api'
import { useOrganizationStore } from '@/app/stores/organizationStore'

interface MedicalTodayWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function MedicalTodayWidget({ editMode, onRemove, dragHandleProps }: MedicalTodayWidgetProps) {
  const t = useTranslations('dashboard')
  const { selectedOrg } = useOrganizationStore()

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()

  // Fetch pending medical tasks for today
  const { data: pendingData } = useQuery({
    queryKey: ['tasks', 'medical', 'pending', selectedOrg?.id, today],
    queryFn: () => ApiClient.getTasks({
      type: 'medical',
      status: 'pending',
      due_date: today,
    }),
    enabled: !!selectedOrg?.id,
  })

  const medicationsDue = pendingData?.total || pendingData?.items?.length || 0

  // Calculate overdue (tasks with due_at in the past)
  const overdue = pendingData?.items?.filter((task: any) => {
    if (!task.due_at) return false
    const dueDate = new Date(task.due_at)
    return dueDate < now
  }).length || 0

  return (
    <WidgetCard
      id="medical-today"
      title={t('medicalToday')}
      icon={HeartPulse}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-[var(--color-primary-soft)] to-[var(--color-primary-soft)] border-[var(--color-primary)]/30"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
            <HeartPulse className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-4xl font-bold text-red-700 dark:text-red-400">{medicationsDue}</p>
            <p className="text-sm text-muted-foreground">{t('medicationsDue')}</p>
          </div>
        </div>

        {overdue > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm text-destructive font-medium">
              {overdue} overdue
            </span>
          </div>
        )}

        <Link href="/dashboard/medical">
          <Button variant="link" size="sm" className="px-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
