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

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'Probíhá',
  completed: 'Dokončeno',
};

const WALK_TYPE_LABELS: Record<string, string> = {
  walk: 'Venčení',
  short_walk: 'Krátká procházka',
  long_walk: 'Dlouhá procházka',
  potty: 'Na toaletu',
};

export default function WalksPage() {
  const t = useTranslations('walks');
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [view, setView] = useState<'today' | 'all'>('today');

  const [newWalk, setNewWalk] = useState({
    animal_ids: [] as string[],
    walk_type: 'walk',
  });
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
      toast.error('Nepodařilo se načíst procházky');
    } finally {
      setLoading(false);
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
      toast.error('Vyberte alespoň jedno zvíře');
      return;
    }
    setCreating(true);
    try {
      await ApiClient.createWalk({
        animal_ids: newWalk.animal_ids,
        walk_type: newWalk.walk_type,
      });
      toast.success('Procházka začala');
      setNewWalk({ animal_ids: [], walk_type: 'walk' });
      loadWalks();
    } catch (error: any) {
      toast.error(error.message || 'Nepodařilo se spustit procházku');
    } finally {
      setCreating(false);
    }
  };

  const completeWalk = async (walkId: string) => {
    try {
      await ApiClient.completeWalk(walkId);
      toast.success('Procházka dokončena');
      loadWalks();
    } catch (error: any) {
      toast.error(error.message || 'Nepodařilo se dokončit procházku');
    }
  };

  const inProgressWalks = walks.filter(w => w.status === 'in_progress');
  const completedWalks = walks.filter(w => w.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Venčení</h1>
          <p className="text-muted-foreground">Správa procházek a venčení zvířat</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('today')}
          >
            Dnes
          </Button>
          <Button
            variant={view === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('all')}
          >
            Všechny
          </Button>
        </div>
      </div>

      {/* Start new walk */}
      <Card>
        <CardHeader>
          <CardTitle>Spustit novou procházku</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Select
              value={newWalk.animal_ids[0] || ''}
              onValueChange={(v) => setNewWalk(p => ({ ...p, animal_ids: [v] }))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Vyberte zvíře" />
              </SelectTrigger>
              <SelectContent>
                {animals.filter((a) => a.status === 'intake' || a.status === 'hotel').map((animal) => (
                  <SelectItem key={animal.id} value={animal.id}>
                    {animal.name} ({animal.public_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={newWalk.walk_type}
              onValueChange={(v) => setNewWalk(p => ({ ...p, walk_type: v }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk">Venčení</SelectItem>
                <SelectItem value="short_walk">Krátká procházka</SelectItem>
                <SelectItem value="long_walk">Dlouhá procházka</SelectItem>
                <SelectItem value="potty">Na toaletu</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={startWalk} disabled={creating || newWalk.animal_ids.length === 0}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Spustit
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
              Probíhající ({inProgressWalks.length})
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
                        {walk.animals?.map(a => a.name).join(', ') || walk.animal_ids[0]?.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Začalo: {format(new Date(walk.started_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => completeWalk(walk.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Dokončit
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
            {view === 'today' ? 'Dokončené dnes' : 'Historie'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : completedWalks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Žádné procházky</p>
          ) : (
            <div className="space-y-2">
              {completedWalks.map((walk) => (
                <div key={walk.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <PawPrint className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {walk.animals?.map(a => a.name).join(', ') || walk.animal_ids[0]?.slice(0, 8)}
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
