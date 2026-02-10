'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'

export function AlertsBell() {
  const t = useTranslations('topbar')

  // TODO: Get actual unacknowledged alert count from API
  const unacknowledgedCount = 0

  return (
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="h-5 w-5" />
      {unacknowledgedCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
        >
          {unacknowledgedCount}
        </Badge>
      )}
      <span className="sr-only">{t('alerts')}</span>
    </Button>
  )
}
