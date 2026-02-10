'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { AppShell } from '@/app/components/app-shell/AppShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, selectedOrg } = useAuth();
  const router = useRouter();
  const t = useTranslations('common');

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!selectedOrg) {
        router.push('/select-org');
      }
    }
  }, [isAuthenticated, isLoading, selectedOrg, router]);

  if (isLoading || !isAuthenticated || !selectedOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
