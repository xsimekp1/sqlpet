'use client';

import { useTranslations } from 'next-intl';
import { Keyboard, BookOpen, Mail, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useShortcutMap } from '@/app/hooks/useKeyboardShortcuts';
import { formatShortcut } from '@/app/lib/shortcuts';
import { DEFAULT_SHORTCUTS } from '@/app/lib/shortcuts';

export default function HelpPage() {
  const t = useTranslations('help');
  const ts = useTranslations('shortcuts');
  const shortcutMap = useShortcutMap();

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
            {t('docs.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('docs.comingSoon')}</p>
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
