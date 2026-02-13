'use client';

import { useTranslations } from 'next-intl';
import { Scale } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/app/stores/uiStore';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { weightUnit, setWeightUnit } = useUIStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('preferences')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-muted">
              <Scale className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{t('weightUnit')}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{t('weightUnitDesc')}</p>
              <div className="flex gap-2 mt-3">
                <Button
                  variant={weightUnit === 'kg' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setWeightUnit('kg')}
                >
                  {t('kg')}
                </Button>
                <Button
                  variant={weightUnit === 'lbs' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setWeightUnit('lbs')}
                >
                  {t('lbs')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
