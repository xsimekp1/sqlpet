'use client'

import { useEffect, useState } from 'react'
import { BarChart3, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import ApiClient from '@/app/lib/api'

interface ShelterStatsWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

interface Stats {
  total: number
  available: number
  intake: number
  quarantine: number
}

export function ShelterStatsWidget({ editMode, onRemove, dragHandleProps }: ShelterStatsWidgetProps) {
  const t = useTranslations('dashboard')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await ApiClient.getAnimals({ page_size: 1 })
        const total = data.total

        const [avail, intake, quarantine] = await Promise.all([
          ApiClient.getAnimals({ page_size: 1, status: 'available' }),
          ApiClient.getAnimals({ page_size: 1, status: 'intake' }),
          ApiClient.getAnimals({ page_size: 1, status: 'quarantine' }),
        ])

        setStats({
          total,
          available: avail.total,
          intake: intake.total,
          quarantine: quarantine.total,
        })
      } catch {
        setStats(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const rows: { label: string; value: number; color: string }[] = stats
    ? [
        { label: t('stats.total'), value: stats.total, color: 'text-foreground' },
        { label: t('stats.available'), value: stats.available, color: 'text-green-600' },
        { label: t('stats.intake'), value: stats.intake, color: 'text-blue-600' },
        { label: t('stats.quarantine'), value: stats.quarantine, color: 'text-orange-600' },
      ]
    : []

  return (
    <WidgetCard
      id="shelter-stats"
      title={t('shelterStats')}
      icon={BarChart3}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-[var(--color-primary-soft)] to-[var(--color-primary-soft)] border-[var(--color-primary)]/30"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          {loading ? (
            <div className="h-10 w-20 rounded bg-primary/10 animate-pulse" />
          ) : (
            <p className="text-6xl font-bold text-primary tracking-tight">{stats?.total ?? '–'}</p>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-5 rounded bg-violet-100/40 animate-pulse" />
            ))}
          </div>
        ) : stats && (
          <div className="space-y-1.5">
            {rows.slice(1).map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={`font-semibold ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        <Link href="/dashboard/animals">
          <Button variant="link" size="sm" className="px-0 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
