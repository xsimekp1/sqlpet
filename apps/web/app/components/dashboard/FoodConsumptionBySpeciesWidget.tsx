'use client'

import { PieChart, ArrowRight, Dog, Cat, Bird, Rabbit } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import ApiClient from '@/app/lib/api'
import { useOrganizationStore } from '@/app/stores/organizationStore'

interface FoodConsumptionBySpeciesWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

interface SpeciesConsumptionItem {
  species: string
  total_grams: number
  animal_count: number
}

const speciesIcons: Record<string, React.ElementType> = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
}

const speciesColors: Record<string, string> = {
  dog: 'text-amber-600 bg-amber-100',
  cat: 'text-purple-600 bg-purple-100',
  bird: 'text-sky-600 bg-sky-100',
  rabbit: 'text-pink-600 bg-pink-100',
  other: 'text-gray-600 bg-gray-100',
}

export function FoodConsumptionBySpeciesWidget({ editMode, onRemove, dragHandleProps }: FoodConsumptionBySpeciesWidgetProps) {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const { selectedOrg } = useOrganizationStore()

  const { data, isLoading } = useQuery({
    queryKey: ['feeding', 'consumption-by-species', selectedOrg?.id],
    queryFn: () => ApiClient.getFoodConsumptionBySpecies(7),
    enabled: !!selectedOrg?.id,
  })

  const formatGrams = (grams: number) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toFixed(1)} kg`
    }
    return `${Math.round(grams)} g`
  }

  const getSpeciesLabel = (species: string) => {
    try {
      return tCommon(`species.${species}` as any)
    } catch {
      return species
    }
  }

  const getSpeciesIcon = (species: string) => {
    return speciesIcons[species] || PieChart
  }

  const getSpeciesColor = (species: string) => {
    return speciesColors[species] || speciesColors.other
  }

  const totalGrams = data?.summary?.total_grams || 0

  return (
    <WidgetCard
      id="food-consumption-by-species"
      title={t('foodConsumptionBySpecies')}
      icon={PieChart}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 border-teal-200/50 dark:border-teal-800/50"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-teal-100 dark:bg-teal-900/50">
            <PieChart className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex-1">
            <p className="text-4xl font-bold text-teal-700 dark:text-teal-300">{formatGrams(totalGrams)}</p>
            <p className="text-sm text-muted-foreground">{t('last7Days')}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-teal-100/50 dark:bg-teal-900/30 rounded animate-pulse" />
            ))}
          </div>
        ) : data && data.by_species.length > 0 ? (
          <div className="space-y-2">
            {data.by_species.slice(0, 5).map((item: SpeciesConsumptionItem) => {
              const Icon = getSpeciesIcon(item.species)
              const colorClass = getSpeciesColor(item.species)
              const percentage = totalGrams > 0 ? Math.round((item.total_grams / totalGrams) * 100) : 0

              return (
                <div
                  key={item.species}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/60 dark:bg-black/20"
                >
                  <div className={`p-2 rounded-lg ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-teal-800 dark:text-teal-200">
                        {getSpeciesLabel(item.species)}
                      </p>
                      <p className="font-semibold text-sm text-teal-600 dark:text-teal-400">
                        {formatGrams(item.total_grams)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-teal-100 dark:bg-teal-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 dark:bg-teal-400 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{percentage}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.animal_count} {item.animal_count === 1 ? 'zvire' : 'zvirat'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('noConsumptionData')}
          </p>
        )}

        <Link href="/dashboard/feeding">
          <Button variant="link" size="sm" className="px-0 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300">
            {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </WidgetCard>
  )
}
