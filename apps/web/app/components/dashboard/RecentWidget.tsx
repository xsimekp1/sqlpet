'use client'

import { Clock, ArrowRight } from 'lucide-react'
import { WidgetCard } from './WidgetCard'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface RecentWidgetProps {
  editMode?: boolean
  onRemove?: () => void
  dragHandleProps?: any
}

export function RecentWidget({ editMode, onRemove, dragHandleProps }: RecentWidgetProps) {
  const t = useTranslations('dashboard')

  // TODO: Fetch real recently viewed items from localStorage/API in M3+
  const recentItems = [
    { id: '123', name: 'Max', type: 'Dog', public_code: 'DOG-2024-001' },
    { id: '456', name: 'Luna', type: 'Cat', public_code: 'CAT-2024-012' },
    { id: '789', name: 'Charlie', type: 'Dog', public_code: 'DOG-2024-003' },
  ]

  return (
    <WidgetCard
      id="recent"
      title={t('recent')}
      icon={Clock}
      editMode={editMode}
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20 border-teal-200/50 dark:border-teal-800/30"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-100 dark:bg-teal-900/30">
            <Clock className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          </div>
          <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
            Recently viewed
          </p>
        </div>

        {recentItems.length > 0 ? (
          <>
            <div className="space-y-2">
              {recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/animals/${item.id}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/60 dark:bg-black/20 hover:bg-teal-100/50 dark:hover:bg-teal-900/20 transition-colors border border-teal-100 dark:border-teal-900/30"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">#{item.public_code}</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-md bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                    {item.type}
                  </span>
                </Link>
              ))}
            </div>

            <Link href="/dashboard/animals">
              <Button variant="link" size="sm" className="px-0 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300">
                {t('viewAll')} <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent items
          </p>
        )}
      </div>
    </WidgetCard>
  )
}
