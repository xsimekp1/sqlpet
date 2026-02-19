'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, Copy, Trash2, Loader2, MapPin, CheckCircle2, AlertTriangle,
  Pencil, Check, X, Plus, QrCode,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ApiClient, { Kennel, KennelStay, Task } from '@/app/lib/api';
import { KennelTaskDialog } from '@/app/components/kennels/KennelTaskDialog';
import { toast } from 'sonner';
import Image from 'next/image';
import QRCode from 'react-qr-code';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

  // Maintenance editing
  const [editingMaintenance, setEditingMaintenance] = useState(false);
  const [maintenanceStart, setMaintenanceStart] = useState('');
  const [maintenanceEnd, setMaintenanceEnd] = useState('');
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [savingSpecies, setSavingSpecies] = useState(false);

  // Actions
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

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
      const dims: { length: number; width: number; height?: number } = { length: Math.round(length * 100), width: Math.round(width * 100) };
      if (height !== undefined && !isNaN(height)) dims.height = Math.round(height * 100);
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

  const handleSaveMaintenance = async () => {
    if (!kennel) return;
    setSavingMaintenance(true);
    try {
      await ApiClient.setKennelMaintenance(kennel.id, {
        start_at: maintenanceStart ? new Date(maintenanceStart).toISOString() : null,
        end_at: maintenanceEnd ? new Date(maintenanceEnd).toISOString() : null,
        reason: maintenanceReason || null,
      });
      // Refresh kennel data
      const res = await fetch(`/api/kennels/${kennelId}`, { headers: getAuthHeaders() });
      const updated = await res.json();
      setKennel(updated);
      toast.success(t('detail.updateSuccess'));
      setEditingMaintenance(false);
    } catch (e: any) {
      toast.error(e.message || 'Chyba při ukládání');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const startEditMaintenance = () => {
    if (kennel) {
      setMaintenanceStart(kennel.maintenance_start_at ? kennel.maintenance_start_at.split('T')[0] : '');
      setMaintenanceEnd(kennel.maintenance_end_at ? kennel.maintenance_end_at.split('T')[0] : '');
      setMaintenanceReason(kennel.maintenance_reason || '');
    }
    setEditingMaintenance(true);
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

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/kennels">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{kennel.name}</h1>
              <p className="text-muted-foreground text-sm">
                {kennel.code} • {getTypeLabel(kennel.type)} • {kennel.capacity} míst
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setQrDialogOpen(true)}>
              <QrCode className="h-4 w-4 mr-1" /> QR
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={copying}>
              {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
              {t('detail.copy')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              {t('detail.delete')}
            </Button>
          </div>
        </div>

        {/* Status & Info Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('detail.status')}</CardTitle>
            </CardHeader>
            <CardContent>
              {editingType ? (
                <Select value={kennel.type} onValueChange={handleSaveType} defaultValue={kennel.type}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indoor">{getTypeLabel('indoor')}</SelectItem>
                    <SelectItem value="outdoor">{getTypeLabel('outdoor')}</SelectItem>
                    <SelectItem value="isolation">{getTypeLabel('isolation')}</SelectItem>
                    <SelectItem value="quarantine">{getTypeLabel('quarantine')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center justify-between">
                  <Badge className={getStatusColor(kennel.status)}>{getStatusLabel(kennel.status)}</Badge>
                  <Select value={kennel.status} onValueChange={handleStatusChange} disabled={changingStatus}>
                    <SelectTrigger className="w-[110px] h-7"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">{getStatusLabel('available')}</SelectItem>
                      <SelectItem value="maintenance">{getStatusLabel('maintenance')}</SelectItem>
                      <SelectItem value="closed">{getStatusLabel('closed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Capacity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('detail.capacity')}</CardTitle>
            </CardHeader>
            <CardContent>
              {editingCapacity ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={capacityInput}
                    onChange={(e) => setCapacityInput(e.target.value)}
                    className="h-8 w-20"
                  />
                  <Button size="sm" onClick={handleSaveCapacity} disabled={savingCapacity}>
                    {savingCapacity ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingCapacity(false)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{kennel.occupied_count} / {kennel.capacity}</span>
                  <Button variant="ghost" size="icon" onClick={() => { setCapacityInput(String(kennel.capacity)); setEditingCapacity(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {kennel.capacity > 0 && (
                <Progress value={(kennel.occupied_count / kennel.capacity) * 100} className="mt-2 h-2" />
              )}
            </CardContent>
          </Card>

          {/* Dimensions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('detail.dimensions')}</CardTitle>
            </CardHeader>
            <CardContent>
              {editingDimensions ? (
                <div className="space-y-2">
                  <div className="flex gap-1 items-center">
                    <Input
                      type="number"
                      placeholder="Délka (m)"
                      value={dimLength}
                      onChange={(e) => setDimLength(e.target.value)}
                      className="h-8 w-20"
                    />
                    <span>×</span>
                    <Input
                      type="number"
                      placeholder="Šířka (m)"
                      value={dimWidth}
                      onChange={(e) => setDimWidth(e.target.value)}
                      className="h-8 w-20"
                    />
                    <span>×</span>
                    <Input
                      type="number"
                      placeholder="Výška (m)"
                      value={dimHeight}
                      onChange={(e) => setDimHeight(e.target.value)}
                      className="h-8 w-20"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleSaveDimensions} disabled={savingDimensions}>
                      {savingDimensions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingDimensions(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : kennel.dimensions ? (
                <div className="flex items-center justify-between">
                  <DimensionsDisplay dimensions={kennel.dimensions} />
                  <Button variant="ghost" size="icon" onClick={() => {
                    const dims = kennel.dimensions!;
                    setDimLength(String(dims.length / 100));
                    setDimWidth(String(dims.width / 100));
                    setDimHeight(dims.height ? String(dims.height / 100) : '');
                    setEditingDimensions(true);
                  }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setEditingDimensions(true)}>
                  <Plus className="h-4 w-4 mr-1" /> {t('detail.addDimensions')}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Allowed Species */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('detail.allowedSpecies')}</CardTitle>
            </CardHeader>
            <CardContent>
              {editingSpecies ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {ALL_SPECIES.map(s => (
                      <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSpecies.includes(s)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSpecies(prev => [...prev, s]);
                            } else {
                              setSelectedSpecies(prev => prev.filter(sp => sp !== s));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        {SPECIES_CONFIG[s].emoji} {SPECIES_CONFIG[s].label}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleSaveSpecies} disabled={savingSpecies}>
                      {savingSpecies ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSpecies(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : kennel.allowed_species && kennel.allowed_species.length > 0 ? (
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {kennel.allowed_species.map(s => (
                      <span key={s} className={`text-lg ${SPECIES_CONFIG[s]?.bg.split(' ')[0]}`}>
                        {SPECIES_CONFIG[s]?.emoji}
                      </span>
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => {
                    setSelectedSpecies(kennel.allowed_species || []);
                    setEditingSpecies(true);
                  }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => {
                  setSelectedSpecies([]);
                  setEditingSpecies(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" /> {t('detail.setSpecies')}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Maintenance Card */}
        <Card className={kennel.maintenance_start_at && new Date(kennel.maintenance_start_at) <= new Date() && (!kennel.maintenance_end_at || new Date(kennel.maintenance_end_at) >= new Date()) ? 'border-yellow-400 bg-yellow-50' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                🔧 {t('maintenance.title') || 'Plánovaná odstávka'}
              </CardTitle>
              {!editingMaintenance ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startEditMaintenance}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Upravit
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button size="sm" onClick={handleSaveMaintenance} disabled={savingMaintenance}>
                    {savingMaintenance ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    {t('maintenance.save') || 'Uložit'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingMaintenance(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingMaintenance ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">{t('maintenance.from') || 'Od'}</label>
                    <Input
                      type="date"
                      value={maintenanceStart}
                      onChange={(e) => setMaintenanceStart(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">{t('maintenance.to') || 'Do'}</label>
                    <Input
                      type="date"
                      value={maintenanceEnd}
                      onChange={(e) => setMaintenanceEnd(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('maintenance.reason') || 'Důvod'}</label>
                  <Input
                    value={maintenanceReason}
                    onChange={(e) => setMaintenanceReason(e.target.value)}
                    placeholder="Např. Malování, oprava..."
                    className="text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {kennel.maintenance_start_at || kennel.maintenance_reason ? (
                  <>
                    {kennel.maintenance_start_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{t('maintenance.from') || 'Od'}:</span>
                        <span className="font-medium">
                          {new Date(kennel.maintenance_start_at).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                    )}
                    {kennel.maintenance_end_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{t('maintenance.to') || 'Do'}:</span>
                        <span className="font-medium">
                          {new Date(kennel.maintenance_end_at).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                    )}
                    {kennel.maintenance_reason && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t('maintenance.reason') || 'Důvod'}: </span>
                        <span className="font-medium">{kennel.maintenance_reason}</span>
                      </div>
                    )}
                    {kennel.maintenance_start_at && new Date(kennel.maintenance_start_at) <= new Date() && (!kennel.maintenance_end_at || new Date(kennel.maintenance_end_at) >= new Date()) && (
                      <div className="mt-2 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-md text-sm font-medium flex items-center gap-2">
                        🔧 {t('maintenance.active') || 'Nyní v rekonstrukci'}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Žádná odstávka není naplánována</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="detail" className="space-y-4">
          <TabsList>
            <TabsTrigger value="detail">{t('detail.tab')}</TabsTrigger>
            <TabsTrigger value="history">{t('detail.historyTab')}</TabsTrigger>
            <TabsTrigger value="tasks">{t('detail.tasksTab')}</TabsTrigger>
          </TabsList>

        {/* ── Detail Tab ────────────────────────────────────────────────── */}
        <TabsContent value="detail">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('detail.animalsInKennel') || 'Zvířata v kotci'}</CardTitle>
            </CardHeader>
            <CardContent>
              {kennel.animals_preview && kennel.animals_preview.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {kennel.animals_preview.map(animal => (
                    <Link
                      key={animal.id}
                      href={`/dashboard/animals/${animal.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {animal.image_url ? (
                        <Image
                          src={animal.image_url}
                          alt={animal.name}
                          width={48}
                          height={48}
                          className="rounded-md object-cover w-12 h-12"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center text-2xl">
                          {SPECIES_CONFIG[animal.species]?.emoji ?? '🐾'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{animal.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {animal.public_code}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {t('detail.noAnimals') || 'Žádná zvířata v tomto kotci'}
                </p>
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

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR kód pro kotec</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {kennel && (
              <>
                <div className="bg-white p-4 rounded-lg border">
                  <QRCode
                    value={`https://sqlpet.vercel.app/cs/public/kennels/${kennelId}`}
                    size={200}
                    level="M"
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Naskenujte QR kód pro rychlý přístup k informacím o zvířatech v tomto kotci.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const svg = document.querySelector('svg');
                    if (!svg) return;
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `kennel-${kennel.code}-qr.svg`;
                    link.href = url;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Stáhnout QR
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── DimensionsDisplay with m² tooltip ──────────────────────────────────────
function DimensionsDisplay({ dimensions }: { dimensions: NonNullable<Kennel['dimensions']> }) {
  const l = dimensions.length;
  const w = dimensions.width;
  const h = dimensions.height;
  if (!l || !w) return null;

  const lm = (l / 100).toFixed(2);
  const wm = (w / 100).toFixed(2);
  const hm = h ? (h / 100).toFixed(2) : null;
  const area = ((l / 100) * (w / 100)).toFixed(2);

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
