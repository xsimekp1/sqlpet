'use client'

import { useEffect, useState } from 'react'
import { PawPrint, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import ApiClient, { Animal } from '@/app/lib/api'
import { getAnimalImageUrl } from '@/app/lib/utils'

interface RecentlyAdmittedWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function RecentlyAdmittedWidget({ editMode, onRemove, dragHandleProps }: RecentlyAdmittedWidgetProps) {
  const t = useTranslations('dashboard')
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ApiClient.getAnimals({ page_size: 5 })
      .then((data) => setAnimals(data.items))
      .catch(() => setAnimals([]))
      .finally(() => setLoading(false))
  }, [])

  const daysSince = (dateStr: string) => {
    const diff = new Date().getTime() - new Date(dateStr).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <WidgetCard
      id="recently-admitted"
      title={t('recentlyAdmitted')}
      icon={PawPrint}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200/50 dark:border-emerald-800/30"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <PawPrint className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {t('recentlyAdmitted')}
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-emerald-100/50 dark:bg-emerald-900/20 animate-pulse" />
            ))}
          </div>
        ) : animals.length > 0 ? (
          <>
            <div className="space-y-2">
              {animals.map((animal) => (
                <Link
                  key={animal.id}
                  href={`/dashboard/animals/${animal.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/60 dark:bg-black/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors border border-emerald-100 dark:border-emerald-900/30"
                >
                  <div className="relative h-8 w-8 rounded-full overflow-hidden bg-muted shrink-0">
                    <Image
                      src={getAnimalImageUrl(animal)}
                      alt={animal.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{animal.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {animal.intake_date
                        ? `${daysSince(animal.intake_date)} d`
                        : '—'}
                    </span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 capitalize shrink-0">
                    {animal.species}
                  </span>
                </Link>
              ))}
            </div>

            <Link href="/dashboard/animals">
              <Button variant="link" size="sm" className="px-0 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300">
                {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('noAnimals')}
          </p>
        )}
      </div>
    </WidgetCard>
  )
}
