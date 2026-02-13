'use client'

import { useEffect, useState } from 'react'
import { Grid3x3, ArrowRight, Loader2 } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import ApiClient, { Kennel } from '@/app/lib/api'

interface OccupancyWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

interface ZoneSummary {
  name: string
  occupied: number
  capacity: number
}

export function OccupancyWidget({ editMode, onRemove, dragHandleProps }: OccupancyWidgetProps) {
  const t = useTranslations('dashboard')
  const [zones, setZones] = useState<ZoneSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ApiClient.getKennels({})
      .then((kennels: Kennel[]) => {
        const grouped = kennels.reduce((acc, k) => {
          const key = k.zone_name || 'Other'
          if (!acc[key]) acc[key] = { name: key, occupied: 0, capacity: 0 }
          acc[key].occupied += k.occupied_count
          acc[key].capacity += k.capacity
          return acc
        }, {} as Record<string, ZoneSummary>)
        setZones(Object.values(grouped))
      })
      .catch(() => {
        // On error show empty state — widget stays visible
        setZones([])
      })
      .finally(() => setLoading(false))
  }, [])

  const totalOccupied = zones.reduce((acc, z) => acc + z.occupied, 0)
  const totalCapacity = zones.reduce((acc, z) => acc + z.capacity, 0)
  const overallPercentage = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0

  return (
    <WidgetCard
      id="occupancy"
      title={t('occupancy')}
      icon={Grid3x3}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200/50 dark:border-purple-800/30"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <Grid3x3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-4xl font-bold text-purple-700 dark:text-purple-400">{totalOccupied}</p>
                <p className="text-sm text-muted-foreground">/ {totalCapacity} {t('totalCapacity')}</p>
              </div>
            </div>

            {/* Overall progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('overall')}</span>
                <span className="font-medium text-purple-700 dark:text-purple-400">
                  {Math.round(overallPercentage)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-purple-100 dark:bg-purple-900/30 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all duration-300"
                  style={{ width: `${overallPercentage}%` }}
                />
              </div>
            </div>

            {/* Zone breakdown */}
            {zones.length > 0 ? (
              <div className="space-y-2">
                {zones.map((zone) => (
                  <div key={zone.name} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/50 dark:bg-black/20">
                    <span className="font-medium">{zone.name}</span>
                    <span className="text-muted-foreground">
                      {zone.occupied}/{zone.capacity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">{t('noKennels')}</p>
            )}
          </>
        )}

        <Link href="/dashboard/kennels">
          <Button variant="link" size="sm" className="px-0 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
