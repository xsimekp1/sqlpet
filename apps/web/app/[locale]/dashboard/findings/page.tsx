'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Search, MapPin, Clock, Dog, PawPrint } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FindingsPage() {
  const t = useTranslations('findings');

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
            <Search className="h-10 w-10 text-primary" />
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

      {/* Features preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              {t('featureLocation')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('featureLocationDesc')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Dog className="h-4 w-4" />
              {t('featureAnimal')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('featureAnimalDesc')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {t('featureHistory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('featureHistoryDesc')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
