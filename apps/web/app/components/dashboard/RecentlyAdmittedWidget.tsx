'use client'

import { useEffect, useState } from 'react'
import { PawPrint, ArrowRight, Calendar } from 'lucide-react'
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
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ApiClient.getAnimals({ page_size: 1 })
      .then((data) => setAnimal(data.items[0] ?? null))
      .catch(() => setAnimal(null))
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
      {loading ? (
        <div className="h-40 rounded-xl bg-emerald-100/50 animate-pulse" />
      ) : animal ? (
        <Link href={`/dashboard/animals/${animal.id}`} className="block group">
          {/* Big photo */}
          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-muted mb-3">
            <Image
              src={getAnimalImageUrl(animal)}
              alt={animal.name}
              fill
              className="object-contain group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          </div>
          {/* Info */}
          <div className="space-y-1.5">
            <p className="text-lg font-bold leading-tight">{animal.name}</p>
            <p className="text-sm text-muted-foreground capitalize">{animal.species}</p>
            {animal.current_intake_date && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <Calendar className="h-3 w-3" />
                <span>{t('daysInShelter', { days: daysSince(animal.current_intake_date) })}</span>
              </div>
            )}
          </div>
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">{t('noAnimals')}</p>
      )}

      <Link href="/dashboard/animals" className="mt-3 block">
        <Button variant="link" size="sm" className="px-0 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300">
          {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </Link>
    </WidgetCard>
  )
}
