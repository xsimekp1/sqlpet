'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Heart, Clock, Search, FileText, Home, CheckCircle, PawPrint } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STAGE_ICONS = [Search, FileText, Heart, Home, CheckCircle, PawPrint]

export default function AdoptionsPage() {
  const t = useTranslations('adoptions')

  const stages = [
    'inquiry',
    'application',
    'meeting',
    'homecheck',
    'approved',
    'adopted',
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Coming Soon
            </Badge>
          </div>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {/* Coming soon card */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Heart className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t('comingSoon')}</h3>
          <p className="text-muted-foreground max-w-md mb-6">
            {t('description')}
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/animals">
              <PawPrint className="h-4 w-4 mr-2" />
              {t('viewAnimals')}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Pipeline preview */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t('pipeline.title')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stages.map((stage, idx) => {
            const Icon = STAGE_ICONS[idx]
            return (
              <Card key={stage} className="opacity-50 pointer-events-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {idx + 1}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <CardTitle className="text-sm font-medium">
                    {t(`pipeline.stages.${stage}`)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">0</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
