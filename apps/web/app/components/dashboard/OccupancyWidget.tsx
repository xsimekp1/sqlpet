'use client'

import { Grid3x3, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'

interface OccupancyWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function OccupancyWidget({ editMode, onRemove, dragHandleProps }: OccupancyWidgetProps) {
  const t = useTranslations('dashboard')

  // TODO: Fetch real data from API in M3+
  const zones = [
    { name: 'Zone A (Dogs)', occupied: 12, capacity: 15 },
    { name: 'Zone B (Cats)', occupied: 8, capacity: 10 },
    { name: 'Zone C (Quarantine)', occupied: 3, capacity: 5 },
  ]

  const totalOccupied = zones.reduce((acc, z) => acc + z.occupied, 0)
  const totalCapacity = zones.reduce((acc, z) => acc + z.capacity, 0)

  const overallPercentage = (totalOccupied / totalCapacity) * 100

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
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <Grid3x3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-4xl font-bold text-purple-700 dark:text-purple-400">{totalOccupied}</p>
            <p className="text-sm text-muted-foreground">/ {totalCapacity} total capacity</p>
          </div>
        </div>

        {/* Overall progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall</span>
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
        <div className="space-y-2">
          {zones.map((zone) => {
            const percentage = (zone.occupied / zone.capacity) * 100
            return (
              <div key={zone.name} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/50 dark:bg-black/20">
                <span className="font-medium">{zone.name}</span>
                <span className="text-muted-foreground">
                  {zone.occupied}/{zone.capacity}
                </span>
              </div>
            )
          })}
        </div>

        <Link href="/dashboard/kennels">
          <Button variant="link" size="sm" className="px-0 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
