'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ApiClient } from '@/app/lib/api';
import { DEFAULT_SHORTCUTS, formatShortcut, eventToCombo } from '@/app/lib/shortcuts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Keyboard, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getShortcutHintsEnabled, setShortcutHintsEnabled } from '@/app/hooks/useShortcutHint';

interface ShortcutEntry {
  action: string;
  key_combo: string;
  is_custom: boolean;
}

export default function ShortcutsSettingsPage() {
  const t = useTranslations('shortcuts');
  const queryClient = useQueryClient();
  const [capturing, setCapturing] = useState<string | null>(null);
  const [hintsEnabled, setHintsEnabled] = useState(true);

  useEffect(() => {
    setHintsEnabled(getShortcutHintsEnabled());
  }, []);

  const handleHintsToggle = (checked: boolean) => {
    setHintsEnabled(checked);
    setShortcutHintsEnabled(checked);
    toast.success(checked ? 'Nápovědy ke zkratkám zapnuty' : 'Nápovědy ke zkratkám vypnuty');
  };

  const { data: shortcuts = [] } = useQuery<ShortcutEntry[]>({
    queryKey: ['shortcuts'],
    queryFn: () => ApiClient.get('/me/shortcuts'),
  });

  const upsertMutation = useMutation({
    mutationFn: ({ action, key_combo }: { action: string; key_combo: string }) =>
      ApiClient.put(`/me/shortcuts/${action}`, { key_combo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortcuts'] });
      toast.success(t('saved'));
    },
    onError: () => toast.error(t('saveError')),
  });

  const resetMutation = useMutation({
    mutationFn: (action: string) => ApiClient.delete(`/me/shortcuts/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortcuts'] });
      toast.success(t('resetToDefault'));
    },
  });

  const startCapture = (action: string) => {
    setCapturing(action);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: string) => {
    e.preventDefault();
    e.stopPropagation();
    const combo = eventToCombo(e.nativeEvent);
    if (['ctrl', 'shift', 'alt'].includes(combo)) return; // Modifier only, wait for more
    setCapturing(null);
    upsertMutation.mutate({ action, key_combo: combo });
  };

  const shortcutMap: Record<string, string> = {};
  for (const s of shortcuts) {
    shortcutMap[s.action] = s.key_combo;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/help">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back')}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Keyboard className="h-6 w-6" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('hints')}</CardTitle>
            <CardDescription>{t('hintsDescription')}</CardDescription>
          </div>
          <Switch
            checked={hintsEnabled}
            onCheckedChange={handleHintsToggle}
          />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('shortcuts')}</CardTitle>
          <CardDescription>{t('clickToEdit')}</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="text-sm text-muted-foreground border-b">
                <th className="text-left py-2">{t('action')}</th>
                <th className="text-left py-2">{t('shortcut')}</th>
                <th className="text-right py-2"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(DEFAULT_SHORTCUTS).map(([action, defaultCombo]) => {
                const currentCombo = shortcutMap[action] ?? defaultCombo;
                const isCustom = !!shortcuts.find(s => s.action === action && s.is_custom);
                const isCapturing = capturing === action;

                return (
                  <tr key={action} className="border-b last:border-0">
                    <td className="py-3">
                      <span className="font-medium text-sm">
                        {t(`actions.${action}` as any)}
                      </span>
                    </td>
                    <td className="py-3">
                      {isCapturing ? (
                        <input
                          autoFocus
                          className="px-3 py-1 border-2 border-primary rounded text-sm font-mono bg-primary/5 outline-none min-w-[120px]"
                          placeholder={t('pressKeys')}
                          onKeyDown={e => handleKeyDown(e, action)}
                          onBlur={() => setCapturing(null)}
                          readOnly
                        />
                      ) : (
                        <button
                          onClick={() => startCapture(action)}
                          className="px-3 py-1 border rounded text-sm font-mono hover:border-primary hover:bg-accent transition-colors"
                        >
                          {formatShortcut(currentCombo)}
                          {isCustom && (
                            <Badge className="ml-2 text-xs" variant="outline">custom</Badge>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {isCustom && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetMutation.mutate(action)}
                          title={t('resetDefault')}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
