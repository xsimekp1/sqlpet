'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Loader2, Play, CheckCircle, Clock, MapPin, Dog, PawPrint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import Link from 'next/link';
import ApiClient, { Animal, Walk, WalkListResponse } from '@/app/lib/api';
import { useAuth } from '@/app/context/AuthContext';
import { userHasPermission } from '@/app/lib/permissions';

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'inProgress',
  completed: 'completed',
};

const WALK_TYPE_LABELS: Record<string, string> = {
  walk: 'Venčení',
  enrichment: 'Enrichment',
  combo: 'Combo',
  short_walk: 'Krátká procházka',
  long_walk: 'Dlouhá procházka',
  potty: 'Na toaletu',
};

const ENRICHMENT_TYPES = [
  { value: 'nosework', key: 'nosework' },
  { value: 'kong', key: 'kong' },
  { value: 'puzzle', key: 'puzzle' },
  { value: 'treats', key: 'treats' },
  { value: 'training', key: 'training' },
  { value: 'play', key: 'play' },
  { value: 'chewing', key: 'chewing' },
  { value: 'calm', key: 'calm' },
];

const INTENSITY_OPTIONS = [
  { value: 'low', key: 'intensityLow' },
  { value: 'medium', key: 'intensityMedium' },
  { value: 'high', key: 'intensityHigh' },
];

export default function WalksPage() {
  const t = useTranslations('walks');
  const tRoot = useTranslations();
  const { user, permissions } = useAuth();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [view, setView] = useState<'today' | 'all'>('today');

  const [newWalk, setNewWalk] = useState({
    animal_ids: [] as string[],
    walk_type: 'walk',
    enrichment_types: [] as string[],
    intensity: '',
  });
  const [showEnrichment, setShowEnrichment] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadWalks();
    loadAnimals();
  }, [view]);

  const loadWalks = async () => {
    setLoading(true);
    try {
      const data: WalkListResponse = view === 'today' 
        ? await ApiClient.getTodayWalks()
        : await ApiClient.getWalks({ page_size: 100 });
      setWalks(data.items || []);
    } catch (error: any) {
      toast.error(t('noActivity'));
    }
  };

  const loadAnimals = async () => {
    try {
      const data = await ApiClient.getAnimals({ page_size: 100 });
      setAnimals(data.items || []);
    } catch {
      // ignore
    }
  };

  const startWalk = async () => {
    if (newWalk.animal_ids.length === 0) {
      toast.error(t('selectAtLeastOne'));
      return;
    }
    setCreating(true);
    try {
      await ApiClient.createWalk({
        animal_ids: newWalk.animal_ids,
        walk_type: newWalk.walk_type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      toast.success(t('activityStarted'));
      setNewWalk({ animal_ids: [], walk_type: 'walk', enrichment_types: [], intensity: '' });
      setShowEnrichment(false);
      loadWalks();
    } catch (error: any) {
      toast.error(error.message || t('failedToStart'));
    } finally {
      setCreating(false);
    }
  };

  const completeWalk = async (walkId: string) => {
    try {
      await ApiClient.completeWalk(walkId);
      toast.success(t('activityCompleted'));
      loadWalks();
    } catch (error: any) {
      toast.error(error.message || t('failedToComplete'));
    }
  };

  const inProgressWalks = walks.filter(w => w.status === 'in_progress');
  const completedWalks = walks.filter(w => w.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground hidden md:block">{t('management')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('today')}
          >
            {t('today')}
          </Button>
          <Button
            variant={view === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('all')}
          >
            {t('all')}
          </Button>
        </div>
      </div>

      {/* Start new walk */}
      <Card>
        <CardHeader>
          <CardTitle>{t('startNew')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Select
              value={newWalk.animal_ids[0] || ''}
              onValueChange={(v) => setNewWalk(p => ({ ...p, animal_ids: [v] }))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('selectAnimal') || 'Vyberte zvíře'} />
              </SelectTrigger>
              <SelectContent>
                {animals.filter((a) => a.status === 'available' || a.status === 'hold' || a.status === 'quarantine').map((animal) => (
                  <SelectItem key={animal.id} value={animal.id}>
                    {animal.name} ({animal.public_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={newWalk.walk_type}
              onValueChange={(v) => {
                setNewWalk(p => ({ ...p, walk_type: v }));
                setShowEnrichment(v === 'enrichment' || v === 'combo');
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk">🐾 {t('walk')}</SelectItem>
                <SelectItem value="enrichment">🧠 {t('enrichment')}</SelectItem>
                <SelectItem value="combo">⚡ {t('combo')}</SelectItem>
                <SelectItem value="short_walk">{t('shortWalk')}</SelectItem>
                <SelectItem value="long_walk">{t('longWalk')}</SelectItem>
                <SelectItem value="potty">{t('potty')}</SelectItem>
              </SelectContent>
            </Select>

            {(showEnrichment || newWalk.walk_type === 'combo') && (
              <div className="flex items-center gap-2 flex-wrap">
                {ENRICHMENT_TYPES.map((type) => (
                  <Badge
                    key={type.value}
                    variant={newWalk.enrichment_types.includes(type.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const current = newWalk.enrichment_types;
                      const updated = current.includes(type.value)
                        ? current.filter(t => t !== type.value)
                        : [...current, type.value];
                      setNewWalk(p => ({ ...p, enrichment_types: updated }));
                    }}
                  >
                    {t(type.key)}
                  </Badge>
                ))}
                <Select
                  value={newWalk.intensity}
                  onValueChange={(v) => setNewWalk(p => ({ ...p, intensity: v }))}
                >
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue placeholder={t('intensity')} />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENSITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={startWalk} disabled={creating || newWalk.animal_ids.length === 0 || !userHasPermission(user, 'tasks.write', permissions)} title={!userHasPermission(user, 'tasks.write', permissions) ? tRoot('errors.noPermission') : undefined}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {t('start')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* In Progress */}
      {inProgressWalks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              {t('inProgress')} ({inProgressWalks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inProgressWalks.map((walk) => (
                <div key={walk.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <PawPrint className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">
                        {walk.animals?.map(a => a.name).join(', ') || (walk.animal_ids?.[0] ? walk.animal_ids[0].slice(0, 8) : '-')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('startedAt')} {format(new Date(walk.started_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => completeWalk(walk.id)} disabled={!userHasPermission(user, 'tasks.write', permissions)} title={!userHasPermission(user, 'tasks.write', permissions) ? tRoot('errors.noPermission') : undefined}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t('complete')}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            {view === 'today' ? t('completedToday') : t('history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : completedWalks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('noWalks')}</p>
          ) : (
            <div className="space-y-2">
              {completedWalks.map((walk) => (
                <div key={walk.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <PawPrint className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {walk.animals?.map(a => a.name).join(', ') || (walk.animal_ids?.[0] ? walk.animal_ids[0].slice(0, 8) : '-')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(walk.started_at), 'd.M. HH:mm')} • {walk.duration_minutes} min
                        {walk.distance_km && ` • ${walk.distance_km} km`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-50">
                    {WALK_TYPE_LABELS[walk.walk_type] || walk.walk_type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}