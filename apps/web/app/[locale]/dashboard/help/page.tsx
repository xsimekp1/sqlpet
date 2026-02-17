'use client';

import { useTranslations } from 'next-intl';
import { Keyboard, BookOpen, Mail, Settings, PawPrint, Grid3x3, Hotel, Footprints, HeartPulse, Bone, Package, CheckSquare, CalendarDays, Users, MessageSquare, Heart, Inbox, BarChart3, HelpCircle, LogIn, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useShortcutMap } from '@/app/hooks/useKeyboardShortcuts';
import { formatShortcut } from '@/app/lib/shortcuts';
import { DEFAULT_SHORTCUTS } from '@/app/lib/shortcuts';

interface PageGuide {
  title: string;
  description: string;
  icon: any;
  href: string;
}

export default function HelpPage() {
  const t = useTranslations('help');
  const ts = useTranslations('shortcuts');
  const shortcutMap = useShortcutMap();

  const mainPages: PageGuide[] = [
    { title: t('pages.dashboard.title'), description: t('pages.dashboard.description'), icon: PawPrint, href: '/dashboard' },
    { title: t('pages.animals.title'), description: t('pages.animals.description'), icon: PawPrint, href: '/dashboard/animals' },
  ];

  const operationsPages: PageGuide[] = [
    { title: t('pages.kennels.title'), description: t('pages.kennels.description'), icon: Grid3x3, href: '/dashboard/kennels' },
    { title: t('pages.hotel.title'), description: t('pages.hotel.description'), icon: Hotel, href: '/dashboard/hotel/reservations' },
    { title: t('pages.walks.title'), description: t('pages.walks.description'), icon: Footprints, href: '/dashboard/walks' },
    { title: t('pages.medical.title'), description: t('pages.medical.description'), icon: HeartPulse, href: '/dashboard/medical' },
    { title: t('pages.feeding.title'), description: t('pages.feeding.description'), icon: Bone, href: '/dashboard/feeding' },
    { title: t('pages.inventory.title'), description: t('pages.inventory.description'), icon: Package, href: '/dashboard/inventory' },
    { title: t('pages.tasks.title'), description: t('pages.tasks.description'), icon: CheckSquare, href: '/dashboard/tasks' },
    { title: t('pages.calendar.title'), description: t('pages.calendar.description'), icon: CalendarDays, href: '/dashboard/calendar' },
  ];

  const peoplePages: PageGuide[] = [
    { title: t('pages.people.title'), description: t('pages.people.description'), icon: Users, href: '/dashboard/people' },
    { title: t('pages.chat.title'), description: t('pages.chat.description'), icon: MessageSquare, href: '/dashboard/chat' },
    { title: t('pages.adoptions.title'), description: t('pages.adoptions.description'), icon: Heart, href: '/dashboard/adoptions' },
  ];

  const systemPages: PageGuide[] = [
    { title: t('pages.intake.title'), description: t('pages.intake.description'), icon: Inbox, href: '/dashboard/intake' },
    { title: t('pages.reports.title'), description: t('pages.reports.description'), icon: BarChart3, href: '/dashboard/reports' },
    { title: t('pages.settings.title'), description: t('pages.settings.description'), icon: Settings, href: '/dashboard/settings' },
    { title: t('pages.help.title'), description: t('pages.help.description'), icon: HelpCircle, href: '/dashboard/help' },
  ];

  const authPages: PageGuide[] = [
    { title: t('pages.selectOrg.title'), description: t('pages.selectOrg.description'), icon: Building2, href: '/select-org' },
    { title: t('pages.login.title'), description: t('pages.login.description'), icon: LogIn, href: '/login' },
  ];

  const PageSection = ({ title, pages }: { title: string; pages: PageGuide[] }) => (
    <div>
      <h3 className="font-semibold text-lg mb-3">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {pages.map((page) => (
          <Link key={page.href} href={page.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted shrink-0">
                    <page.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{page.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{page.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            {t('shortcuts.title')}
          </CardTitle>
          <Link href="/dashboard/settings/shortcuts">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              {ts('title')}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.keys(DEFAULT_SHORTCUTS).map(action => (
              <div key={action} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm">{ts(`actions.${action}` as any)}</span>
                <div className="flex gap-1">
                  {formatShortcut(shortcutMap[action] ?? DEFAULT_SHORTCUTS[action]).split('+').map((part, i) => (
                    <kbd key={i} className="inline-flex h-6 items-center rounded border border-border bg-muted px-1.5 font-mono text-xs">{part}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t('guide.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PageSection title={t('guide.main')} pages={mainPages} />
          <PageSection title={t('guide.operations')} pages={operationsPages} />
          <PageSection title={t('guide.people')} pages={peoplePages} />
          <PageSection title={t('guide.system')} pages={systemPages} />
          <PageSection title={t('guide.auth')} pages={authPages} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('support.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('support.description')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
