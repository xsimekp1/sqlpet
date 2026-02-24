'use client'

import { Package, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import ApiClient from '@/app/lib/api'
import { useOrganizationStore } from '@/app/stores/organizationStore'

interface FoodConsumptionWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

interface FoodConsumptionItem {
  food_name: string
  brand: string | null
  food_type: string
  total_grams: number
  animal_count: number
}

export function FoodConsumptionWidget({ editMode, onRemove, dragHandleProps }: FoodConsumptionWidgetProps) {
  const t = useTranslations('dashboard')
  const { selectedOrg } = useOrganizationStore()

  const { data: consumptionData, isLoading } = useQuery({
    queryKey: ['feeding', 'consumption', selectedOrg?.id],
    queryFn: () => ApiClient.getFoodConsumptionToday(),
    enabled: !!selectedOrg?.id,
  })

  const formatGrams = (grams: number) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(1)} kg`
    }
    return `${grams} g`
  }

  const getFoodTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      dry: 'dry',
      wet: 'wet',
      raw: 'raw',
      medical: 'medical',
      other: 'other',
    }
    return labels[type] || type
  }

  const totalGrams = consumptionData?.reduce((sum: number, item: FoodConsumptionItem) => sum + item.total_grams, 0) || 0

  return (
    <WidgetCard
      id="food-consumption"
      title={t('foodConsumption')}
      icon={Package}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/50 dark:border-amber-800/30"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-4xl font-bold text-amber-700 dark:text-amber-400">{formatGrams(totalGrams)}</p>
            <p className="text-sm text-muted-foreground">{t('totalDaily')}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-amber-100/50 dark:bg-amber-900/20 rounded animate-pulse" />
            ))}
          </div>
        ) : consumptionData && consumptionData.length > 0 ? (
          <div className="space-y-2">
            {consumptionData.slice(0, 5).map((item: FoodConsumptionItem, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-black/20"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-amber-900 dark:text-amber-100">
                    {item.food_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.animal_count} {item.animal_count === 1 ? 'zvíře' : 'zvířat'} · {getFoodTypeLabel(item.food_type)}
                  </p>
                </div>
                <p className="font-semibold text-sm text-amber-700 dark:text-amber-400 ml-2">
                  {formatGrams(item.total_grams)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('noFeedingPlans')}
          </p>
        )}

        <Link href="/dashboard/feeding/plans">
          <Button variant="link" size="sm" className="px-0 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
