'use client'

import { useEffect, useState } from 'react'
import { PawPrint, ArrowRight, Loader2 } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import ApiClient, { Walk, WalkListResponse } from '@/app/lib/api'
import { format } from 'date-fns'

interface WalksTodayWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function WalksTodayWidget({ editMode, onRemove, dragHandleProps }: WalksTodayWidgetProps) {
  const t = useTranslations('dashboard')

  const [walks, setWalks] = useState<Walk[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWalks = async () => {
      try {
        setLoading(true)
        const data: WalkListResponse = await ApiClient.getWalks({ page_size: 3 })
        setWalks(data.items || [])
      } catch {
        setWalks([])
      } finally {
        setLoading(false)
      }
    }
    fetchWalks()
  }, [])

  return (
    <WidgetCard
      id="walks-today"
      title={t('walksToday')}
      icon={PawPrint}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-[var(--color-primary-soft)] to-[var(--color-primary-soft)] border-[var(--color-primary)]/30"
    >
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : walks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Dnes ještě nikdo nevenčil
          </p>
        ) : (
          <div className="space-y-2">
            {walks.map((walk) => (
              <div
                key={walk.id}
                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[var(--color-primary-soft)]/20 border border-[var(--color-primary-soft)]"
              >
                <div className="flex items-center gap-2">
                  <PawPrint className="h-4 w-4 text-[var(--color-primary)]" />
                  <div>
                    <p className="text-sm font-medium">
                      {walk.animals?.map(a => a.name).join(', ') || (walk.animal_ids?.[0] ? walk.animal_ids[0].slice(0, 8) : '-')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(walk.started_at), 'HH:mm')}
                      {walk.duration_minutes && ` • ${walk.duration_minutes} min`}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  walk.status === 'completed' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {walk.status === 'completed' ? 'Dokončeno' : 'Probíhá'}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link href="/dashboard/walks">
          <Button variant="link" size="sm" className="px-0 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
