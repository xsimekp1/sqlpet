'use client'

import { HeartPulse, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface MedicalTodayWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function MedicalTodayWidget({ editMode, onRemove, dragHandleProps }: MedicalTodayWidgetProps) {
  const t = useTranslations('dashboard')

  // TODO: Fetch real data from API in M3+
  const medicationsDue = 3
  const overdue = 1

  return (
    <WidgetCard
      id="medical-today"
      title={t('medicalToday')}
      icon={HeartPulse}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
    >
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold">{medicationsDue}</p>
          <p className="text-sm text-muted-foreground">{t('medicationsDue')}</p>
        </div>

        {overdue > 0 && (
          <div className="text-sm text-destructive font-medium">
            {overdue} overdue
          </div>
        )}

        <Link href="/dashboard/medical">
          <Button variant="link" size="sm" className="px-0">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
