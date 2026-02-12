'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Building2, ChevronRight } from 'lucide-react';

export default function SelectOrgPage() {
  const t = useTranslations();
  const { memberships, selectOrganization, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSelectOrg = async (orgId: string) => {
    setSelecting(orgId);
    try {
      await selectOrganization(orgId);
    } catch (error) {
      console.error('Failed to select organization:', error);
      setSelecting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-2xl">
        <Card className="border-slate-200 dark:border-slate-700 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              {t('selectOrg.title')}
            </CardTitle>
            <CardDescription>
              {memberships.length > 0
                ? 'Select an organization to continue'
                : t('selectOrg.noMemberships')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {memberships.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('selectOrg.noMemberships')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {memberships.map((membership) => (
                  <Button
                    key={membership.id}
                    variant="outline"
                    className="w-full justify-between h-auto py-4 px-6"
                    onClick={() => handleSelectOrg(membership.organization_id)}
                    disabled={selecting !== null}
                  >
                    <div className="flex items-center gap-4">
                      <Building2 className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <div className="font-semibold text-base">
                          {membership.organization_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t('selectOrg.role')}: {membership.role_name}
                        </div>
                      </div>
                    </div>
                    {selecting === membership.organization_id ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
