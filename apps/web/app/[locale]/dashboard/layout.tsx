'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { AppShell } from '@/app/components/app-shell/AppShell';
import { useKeyboardShortcuts } from '@/app/hooks/useKeyboardShortcuts';
import { AnimalsPrefetcher } from '@/app/components/AnimalsPrefetcher';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, selectedOrg, onboardingCompleted, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = params?.locale as string || 'cs';
  const t = useTranslations('common');
  useKeyboardShortcuts();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!selectedOrg) {
        router.push('/select-org');
      } else if (!onboardingCompleted && !user?.is_superadmin) {
        const setupPath = `/${locale}/dashboard/setup`;
        if (!pathname.startsWith(setupPath)) {
          router.push(setupPath);
        }
      }
    }
  }, [isAuthenticated, isLoading, selectedOrg, onboardingCompleted, pathname, locale, router]);

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

  // Setup wizard uses its own layout — don't wrap with AppShell
  if (!onboardingCompleted && !user?.is_superadmin && pathname.startsWith(`/${locale}/dashboard/setup`)) {
    return <>{children}</>;
  }

  return (
    <AppShell>
      <AnimalsPrefetcher />
      {children}
    </AppShell>
  );
}
