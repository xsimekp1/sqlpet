'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { Edit3, Check } from 'lucide-react';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { user } = useAuth();
  const { dashboardEditMode, setDashboardEditMode } = useUIStore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('welcome')}, {user?.name}
          </p>
        </div>

        {/* Edit Mode Toggle */}
        <Button
          variant={dashboardEditMode ? 'default' : 'outline'}
          onClick={() => setDashboardEditMode(!dashboardEditMode)}
          className="gap-2"
        >
          {dashboardEditMode ? (
            <>
              <Check className="h-4 w-4" />
              {t('done')}
            </>
          ) : (
            <>
              <Edit3 className="h-4 w-4" />
              {t('customize')}
            </>
          )}
        </Button>
      </div>

      {/* Dashboard Widgets */}
      <DashboardGrid />
    </div>
  );
}
