'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, Copy, Trash2, Loader2, MapPin, CheckCircle2, AlertTriangle,
  Pencil, Check, X, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ApiClient, { Kennel, KennelStay, Task } from '@/app/lib/api';
import { KennelTaskDialog } from '@/app/components/kennels/KennelTaskDialog';
import { toast } from 'sonner';
import Image from 'next/image';

// ── Helpers ────────────────────────────────────────────────────────────────

const SPECIES_CONFIG: Record<string, { emoji: string; label: string; bg: string }> = {
  dog:    { emoji: '🐕', label: 'Pes',    bg: 'bg-amber-100 text-amber-700' },
  cat:    { emoji: '🐈', label: 'Kočka',  bg: 'bg-purple-100 text-purple-700' },
  bird:   { emoji: '🐦', label: 'Pták',   bg: 'bg-sky-100 text-sky-700' },
  rabbit: { emoji: '🐇', label: 'Králík', bg: 'bg-pink-100 text-pink-700' },
  other:  { emoji: '🐾', label: 'Jiné',   bg: 'bg-gray-100 text-gray-600' },
};
const ALL_SPECIES = ['dog', 'cat', 'bird', 'rabbit', 'other'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':   return 'bg-green-100 text-green-800';
    case 'maintenance': return 'bg-yellow-100 text-yellow-800';
    case 'closed':      return 'bg-red-100 text-red-800';
    default:            return 'bg-gray-100 text-gray-800';
  }
};

const getTypeLabel = (type: string) => ({
  indoor: 'Vnitřní', outdoor: 'Venkovní', isolation: 'Izolace', quarantine: 'Karanténa',
}[type] ?? type);

const getStatusLabel = (status: string) => ({
  available: 'Dostupný', maintenance: 'Údržba', closed: 'Uzavřený',
}[status] ?? status);

const getPriorityColor = (priority: string) => ({
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}[priority] ?? 'bg-gray-100 text-gray-600');

const getTaskTypeLabel = (type: string) => ({
  cleaning: '🧹 Úklid', maintenance: '🔧 Údržba', general: '📋 Obecný',
  medical: '💊 Lékařský', feeding: '🍖 Krmení', administrative: '📄 Admin',
}[type] ?? type);

function formatDuration(startAt: string, endAt: string | null | undefined): string {
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'méně než den';
  if (days === 1) return '1 den';
  if (days < 7) return `${days} dní`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 týden';
  if (weeks < 5) return `${weeks} týdny`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 měsíc';
  return `${months} měsíců`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function KennelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const kennelId = params.id as string;
  const t = useTranslations('kennels');

  const [kennel, setKennel] = useState<Kennel | null>(null);
  const [stays, setStays] = useState<KennelStay[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Name inline edit
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Type inline edit
  const [editingType, setEditingType] = useState(false);
  const [savingType, setSavingType] = useState(false);

  // Capacity inline edit
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Dimensions inline edit
  const [editingDimensions, setEditingDimensions] = useState(false);
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimHeight, setDimHeight] = useState('');
  const [savingDimensions, setSavingDimensions] = useState(false);

  // Status change
  const [changingStatus, setChangingStatus] = useState(false);

  // Species editing
  const [editingSpecies, setEditingSpecies] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [savingSpecies, setSavingSpecies] = useState(false);

  // Actions
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  useEffect(() => {
    if (!kennelId) return;
    const load = async () => {
      try {
        setLoading(true);
        const [k, s, taskResp] = await Promise.all([
          ApiClient.getKennel(kennelId),
          ApiClient.getKennelStays(kennelId).catch(() => []),
          ApiClient.getTasks({ related_entity_id: kennelId, page_size: 50 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 50 })),
        ]);
        setKennel(k);
        setStays(s);
        setTasks(taskResp.items);
      } catch {
        toast.error('Nepodařilo se načíst kotec');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [kennelId]);

  const handleSaveName = async () => {
    if (!kennel || !nameInput.trim()) return;
    setSavingName(true);
    try {
      const updated = await ApiClient.updateKennel(kennel.id, { name: nameInput.trim() });
      setKennel(prev => prev ? { ...prev, name: updated.name } : null);
      toast.success(t('detail.updateSuccess'));
      setEditingName(false);
    } catch (e: any) {
      toast.error(e.message || 'Chyba při ukládání jména');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveType = async (newType: string) => {
    if (!kennel) return;
    setSavingType(true);
    try {
      const updated = await ApiClient.updateKennel(kennel.id, { type: newType as 'indoor' | 'outdoor' | 'isolation' | 'quarantine' });
      setKennel(prev => prev ? { ...prev, type: updated.type } : null);
      toast.success(t('detail.updateSuccess'));
      setEditingType(false);
    } catch (e: any) {
      toast.error(e.message || 'Chyba při ukládání typu');
    } finally {
      setSavingType(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!kennel) return;
    setChangingStatus(true);
    try {
      const updated = await ApiClient.updateKennel(kennel.id, { status: newStatus });
      setKennel(prev => prev ? { ...prev, status: updated.status } : null);
      toast.success(t('detail.updateSuccess'));
    } catch (e: any) {
      toast.error(e.message || 'Chyba při změně stavu');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleSaveCapacity = async () => {
    if (!kennel) return;
    const newCap = parseInt(capacityInput);
    if (isNaN(newCap) || newCap < 1) return;
    if (newCap < kennel.occupied_count) {
      if (!confirm(t('detail.capacityWarning').replace('{count}', String(kennel.occupied_count)))) return;
    }
    setSavingCapacity(true);
    try {
      const updated = await ApiClient.updateKennel(kennel.id, { capacity: newCap });
      setKennel(prev => prev ? { ...prev, capacity: updated.capacity } : null);
      toast.success(t('detail.updateSuccess'));
      setEditingCapacity(false);
    } catch (e: any) {
      toast.error(e.message || 'Chyba při ukládání kapacity');
    } finally {
      setSavingCapacity(false);
    }
  };

  const handleSaveDimensions = async () => {
    if (!kennel) return;
    const length = parseFloat(dimLength);
    const width = parseFloat(dimWidth);
    const height = dimHeight ? parseFloat(dimHeight) : undefined;
    if (isNaN(length) || isNaN(width)) return;
    setSavingDimensions(true);
    try {
      const dims: { length: number; width: number; height?: number } = { length, width };
      if (height !== undefined && !isNaN(height)) dims.height = height;
      const updated = await ApiClient.updateKennel(kennel.id, { dimensions: dims });
      setKennel(prev => prev ? { ...prev, dimensions: updated.dimensions } : null);
      toast.success(t('detail.updateSuccess'));
      setEditingDimensions(false);
    } catch (e: any) {
      toast.error(e.message || 'Chyba při ukládání rozměrů');
    } finally {
      setSavingDimensions(false);
    }
  };

  const handleSaveSpecies = async () => {
    if (!kennel) return;
    setSavingSpecies(true);
    try {
      const newSpecies = selectedSpecies.length > 0 ? selectedSpecies : null;
      const updated = await ApiClient.updateKennel(kennel.id, { allowed_species: newSpecies });
      setKennel(prev => prev ? { ...prev, allowed_species: updated.allowed_species } : null);
      toast.success(t('detail.updateSuccess'));
      setEditingSpecies(false);
      // Warn if any current animals are incompatible with new species restriction
      if (newSpecies && kennel.animals_preview && kennel.animals_preview.length > 0) {
        const incompatible = kennel.animals_preview.filter(a => !newSpecies.includes(a.species));
        if (incompatible.length > 0) {
          toast.warning(
            `Pozor: ${incompatible.map(a => a.name).join(', ')} ${incompatible.length === 1 ? 'není' : 'nejsou'} kompatibilní s novou vhodností kotce.`
          );
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Chyba při ukládání');
    } finally {
      setSavingSpecies(false);
    }
  };

  const handleDelete = async () => {
    if (!kennel) return;
    if (kennel.occupied_count > 0) {
      toast.error(t('detail.deleteHasAnimals'));
      return;
    }
    if (!confirm(`Smazat kotec "${kennel.name}"? Tato akce je nevratná.`)) return;
    setDeleting(true);
    try {
      await ApiClient.deleteKennel(kennel.id);
      toast.success(t('detail.deleteSuccess'));
      router.push('/dashboard/kennels');
    } catch (e: any) {
      toast.error(e.message || 'Nepodařilo se smazat kotec');
      setDeleting(false);
    }
  };

  const handleCopy = async () => {
    if (!kennel) return;
    setCopying(true);
    try {
      const created = await ApiClient.createKennel({
        name: `${kennel.name} (kopie)`,
        zone_id: kennel.zone_id,
        type: kennel.type,
        size_category: kennel.size_category,
        capacity: kennel.capacity,
        allowed_species: kennel.allowed_species,
        notes: kennel.notes,
      });
      toast.success(t('detail.copySuccess'));
      router.push(`/dashboard/kennels/${created.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Nepodařilo se zkopírovat kotec');
      setCopying(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const updated = await ApiClient.completeTask(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      toast.success('Úkol dokončen');
    } catch (e: any) {
      toast.error(e.message || 'Chyba');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!kennel) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/kennels">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Kotec nenalezen</p>
            <Link href="/dashboard/kennels">
              <Button className="mt-4">Zpět na kotce</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const occupancyPercent = Math.min((kennel.occupied_count / kennel.capacity) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/kennels">
          <Button variant="ghost" size="icon" className="mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="h-9 text-xl font-bold w-48"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveName} disabled={savingName}>
                  {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingName(false)}>
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <h1 className="text-2xl font-bold truncate">{kennel.name}</h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setNameInput(kennel.name); setEditingName(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Inline status select */}
            <Select value={kennel.status} onValueChange={handleStatusChange} disabled={changingStatus}>
              <SelectTrigger className={`h-7 text-xs px-2.5 w-auto border-0 rounded-full ${getStatusColor(kennel.status)}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['available', 'maintenance', 'closed'] as const).map(s => (
                  <SelectItem key={s} value={s}>
                    {getStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Species badges */}
            {kennel.allowed_species && kennel.allowed_species.length > 0 && (
              <div className="flex gap-1">
                {kennel.allowed_species.map(s => {
                  const cfg = SPECIES_CONFIG[s] || SPECIES_CONFIG.other;
                  return (
                    <span key={s} title={cfg.label} className={`text-sm px-1.5 py-0.5 rounded-full ${cfg.bg}`}>
                      {cfg.emoji}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-0.5">
            {kennel.code} · {kennel.zone_name}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={copying}>
            {copying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
            {t('detail.copyKennel')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting} className="text-destructive hover:text-destructive">
            {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            {t('detail.deleteKennel')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('detail.overviewTab')}</TabsTrigger>
          <TabsTrigger value="history">{t('detail.historyTab')}</TabsTrigger>
          <TabsTrigger value="tasks">
            {t('detail.tasksTab')}
            {tasks.filter(tk => tk.status !== 'completed' && tk.status !== 'cancelled').length > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">
                {tasks.filter(tk => tk.status !== 'completed' && tk.status !== 'cancelled').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Alerts */}
          {kennel.alerts && kennel.alerts.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                  <div className="flex flex-wrap gap-2">
                    {kennel.alerts.map((a, i) => (
                      <span key={i} className="text-sm text-yellow-800">{a}</span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Info card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('detail.infoCard')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('detail.type')}</span>
                  {editingType ? (
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={kennel.type}
                        onValueChange={v => { handleSaveType(v); }}
                        disabled={savingType}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="indoor">Vnitřní</SelectItem>
                          <SelectItem value="outdoor">Venkovní</SelectItem>
                          <SelectItem value="isolation">Izolace</SelectItem>
                          <SelectItem value="quarantine">Karanténa</SelectItem>
                        </SelectContent>
                      </Select>
                      {savingType && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingType(false)}>
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{getTypeLabel(kennel.type)}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingType(true)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.zone')}</span>
                  <span className="font-medium">{kennel.zone_name}</span>
                </div>

                {/* Capacity — inline edit */}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('detail.capacity')}</span>
                  {editingCapacity ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        value={capacityInput}
                        onChange={e => setCapacityInput(e.target.value)}
                        className="h-7 w-20 text-sm"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveCapacity} disabled={savingCapacity}>
                        {savingCapacity ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCapacity(false)}>
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{kennel.capacity}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setCapacityInput(String(kennel.capacity)); setEditingCapacity(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Dimensions — inline edit */}
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">{t('detail.dimensions')}</span>
                  {editingDimensions ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder="Délka (m)"
                          value={dimLength}
                          onChange={e => setDimLength(e.target.value)}
                          className="h-7 w-20 text-xs"
                          autoFocus
                        />
                        <span className="text-xs text-muted-foreground">×</span>
                        <Input
                          type="number"
                          placeholder="Šířka (m)"
                          value={dimWidth}
                          onChange={e => setDimWidth(e.target.value)}
                          className="h-7 w-20 text-xs"
                        />
                        <Input
                          type="number"
                          placeholder="Výška cm"
                          value={dimHeight}
                          onChange={e => setDimHeight(e.target.value)}
                          className="h-7 w-20 text-xs"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveDimensions} disabled={savingDimensions}>
                          {savingDimensions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingDimensions(false)}>
                          <X className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {kennel.dimensions?.length && kennel.dimensions?.width ? (
                        <DimensionsDisplay dimensions={kennel.dimensions} />
                      ) : (
                        <span className="text-muted-foreground text-xs">Neuvedeno</span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setDimLength(String(kennel.dimensions?.length ?? ''));
                          setDimWidth(String(kennel.dimensions?.width ?? ''));
                          setDimHeight(String(kennel.dimensions?.height ?? ''));
                          setEditingDimensions(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Last cleaned */}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Poslední čištění</span>
                  <span className={`text-sm font-medium ${!kennel.last_cleaned_at ? 'text-muted-foreground/50 italic' : ''}`}>
                    {kennel.last_cleaned_at
                      ? new Date(kennel.last_cleaned_at).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Nezaznamenáno'}
                  </span>
                </div>

                {kennel.notes && (
                  <div>
                    <span className="text-muted-foreground block mb-0.5">{t('detail.notes')}</span>
                    <p className="text-sm">{kennel.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Occupancy card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {t('detail.occupancyCard')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Obsazenost</span>
                  <span className="font-medium">{kennel.occupied_count}/{kennel.capacity}</span>
                </div>
                <Progress value={occupancyPercent} className="h-3" />
                <p className="text-xs text-muted-foreground text-right">{occupancyPercent.toFixed(0)}%</p>

                {kennel.animals_preview && kennel.animals_preview.length > 0 && (
                  <div className="pt-1 space-y-2">
                    {kennel.animals_preview.map(a => (
                      <Link
                        key={a.id}
                        href={`/dashboard/animals/${a.id}`}
                        className="flex items-center gap-2 hover:text-primary transition-colors"
                      >
                        <div className="relative h-8 w-8 rounded-full overflow-hidden bg-muted shrink-0">
                          <Image
                            src={a.photo_url || (a.species === 'dog' ? '/dog-default.png' : a.species === 'cat' ? '/cat_default.png' : '/placeholder-animal.svg')}
                            alt={a.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium hover:underline truncate">{a.name}</p>
                          {a.start_at && (
                            <p className="text-xs text-muted-foreground">od {formatDate(a.start_at)}</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Species card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('detail.speciesCard')}</CardTitle>
                {!editingSpecies ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedSpecies(kennel.allowed_species ?? []); setEditingSpecies(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Upravit
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleSaveSpecies} disabled={savingSpecies}>
                      {savingSpecies ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                      Uložit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSpecies(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingSpecies ? (
                <div className="flex flex-wrap gap-2">
                  {ALL_SPECIES.map(s => {
                    const cfg = SPECIES_CONFIG[s] || SPECIES_CONFIG.other;
                    const active = selectedSpecies.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSpecies(prev =>
                          active ? prev.filter(x => x !== s) : [...prev, s]
                        )}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          active
                            ? `${cfg.bg} border-current`
                            : 'bg-muted/30 text-muted-foreground border-transparent hover:border-muted'
                        }`}
                      >
                        {cfg.emoji} {cfg.label}
                        {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              ) : kennel.allowed_species && kennel.allowed_species.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {kennel.allowed_species.map(s => {
                    const cfg = SPECIES_CONFIG[s] || SPECIES_CONFIG.other;
                    return (
                      <span key={s} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${cfg.bg}`}>
                        {cfg.emoji} {cfg.label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nevyplněno — vhodný pro všechna zvířata</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── History Tab ──────────────────────────────────────────────── */}
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4">
              {stays.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('detail.noHistory')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left p-2 font-medium">Zvíře</th>
                        <th className="text-left p-2 font-medium">Druh</th>
                        <th className="text-left p-2 font-medium">Od</th>
                        <th className="text-left p-2 font-medium">Do</th>
                        <th className="text-left p-2 font-medium">Délka</th>
                        <th className="text-left p-2 font-medium">Důvod</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stays.map(stay => (
                        <tr key={stay.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-2">
                            <Link
                              href={`/dashboard/animals/${stay.animal_id}`}
                              className="hover:text-primary hover:underline font-medium"
                            >
                              {stay.animal_name}
                              {stay.animal_public_code && (
                                <span className="text-muted-foreground font-normal ml-1">#{stay.animal_public_code}</span>
                              )}
                            </Link>
                          </td>
                          <td className="p-2">
                            {stay.animal_species && (
                              <span>
                                {SPECIES_CONFIG[stay.animal_species]?.emoji ?? '🐾'}{' '}
                                {SPECIES_CONFIG[stay.animal_species]?.label ?? stay.animal_species}
                              </span>
                            )}
                          </td>
                          <td className="p-2 whitespace-nowrap">{formatDate(stay.start_at)}</td>
                          <td className="p-2 whitespace-nowrap">
                            {stay.end_at ? (
                              formatDate(stay.end_at)
                            ) : (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                {t('detail.stayCurrent')}
                              </Badge>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground whitespace-nowrap">
                            {formatDuration(stay.start_at, stay.end_at)}
                          </td>
                          <td className="p-2 text-muted-foreground">{stay.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tasks Tab ────────────────────────────────────────────────── */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('detail.tasksTab')}</CardTitle>
                <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('detail.addTask')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('detail.noTasks')}</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-start justify-between gap-3 p-3 rounded-lg border transition-opacity ${
                        task.status === 'completed' || task.status === 'cancelled' ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`font-medium text-sm truncate ${task.status === 'completed' ? 'line-through' : ''}`}>
                            {task.title}
                          </span>
                          <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getTaskTypeLabel(task.type)}
                          </Badge>
                        </div>
                        {task.due_at && (
                          <p className="text-xs text-muted-foreground">
                            Termín: {formatDate(task.due_at)}
                          </p>
                        )}
                      </div>
                      {task.status !== 'completed' && task.status !== 'cancelled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-green-600 hover:text-green-700"
                          onClick={() => handleCompleteTask(task.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Dokončit
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <KennelTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        kennelId={kennelId}
        onCreated={task => setTasks(prev => [task, ...prev])}
      />
    </div>
  );
}

// ── DimensionsDisplay with m² tooltip ──────────────────────────────────────
function DimensionsDisplay({ dimensions }: { dimensions: NonNullable<Kennel['dimensions']> }) {
  const l = dimensions.length;
  const w = dimensions.width;
  const h = dimensions.height;
  if (!l || !w) return null;

  const lm = l.toFixed(1);
  const wm = w.toFixed(1);
  const hm = h ? h.toFixed(1) : null;
  const area = (l * w).toFixed(2);

  const label = hm
    ? `${lm} × ${wm} × ${hm} m (výška)`
    : `${lm} × ${wm} m`;

  return (
    <span
      className="font-medium cursor-help underline decoration-dotted"
      title={`Plocha: ${area} m²`}
    >
      {label}
    </span>
  );
}
