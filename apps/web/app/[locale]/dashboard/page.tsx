'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher';
import { Building2, LogOut, User } from 'lucide-react';

export default function DashboardPage() {
  const t = useTranslations();
  const { user, selectedOrg, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">PawShelter</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedOrg?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Button variant="ghost" onClick={logout} className="gap-2">
                <LogOut className="h-4 w-4" />
                {t('common.logout') || 'Logout'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Welcome Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">
                {t('dashboard.welcome')}, {user?.name}!
              </CardTitle>
              <CardDescription>
                {t('dashboard.title')} - {selectedOrg?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-medium">{selectedOrg?.role}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Milestone 1 Complete */}
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800">
            <CardHeader>
              <CardTitle className="text-green-700 dark:text-green-400">
                🎉 Milestone 1 Complete!
              </CardTitle>
              <CardDescription>
                Next.js frontend with authentication is now working
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>✅ Next.js 14 App Router setup</li>
                <li>✅ TailwindCSS + shadcn/ui</li>
                <li>✅ next-intl (cs/en) localization</li>
                <li>✅ API client with authentication</li>
                <li>✅ Login flow with JWT tokens</li>
                <li>✅ Organization selection</li>
                <li>✅ Protected routes</li>
                <li>✅ Ready for Vercel deployment</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
