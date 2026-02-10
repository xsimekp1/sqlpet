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

  return (
    <WidgetCard
      id="occupancy"
      title={t('occupancy')}
      icon={Grid3x3}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
    >
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold">{totalOccupied}</p>
          <p className="text-sm text-muted-foreground">/ {totalCapacity} total</p>
        </div>

        <div className="space-y-2">
          {zones.map((zone) => {
            const percentage = (zone.occupied / zone.capacity) * 100
            return (
              <div key={zone.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{zone.name}</span>
                  <span className="text-muted-foreground">
                    {zone.occupied}/{zone.capacity}
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            )
          })}
        </div>

        <Link href="/dashboard/kennels">
          <Button variant="link" size="sm" className="px-0">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
