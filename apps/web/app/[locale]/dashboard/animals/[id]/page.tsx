'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, Trash2, MapPin, Loader2, Stethoscope,
  CheckCircle2, XCircle, HelpCircle, AlertTriangle, Pill, Scissors,
  ChevronLeft, ChevronRight, Baby, Scale, Accessibility,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import ApiClient, { Animal, WeightLog, MERCalculation } from '@/app/lib/api';
import MERCalculator from '@/app/components/feeding/MERCalculator';
import { getAnimalImageUrl } from '@/app/lib/utils';
import { toast } from 'sonner';
import RequestMedicalProcedureDialog from '@/app/components/animals/RequestMedicalProcedureDialog';
import BirthDialog from '@/app/components/animals/BirthDialog';
import { EditableAnimalName, EditableAnimalDetails, AssignKennelButton } from '@/app/components/animals';
import { calcMER } from '@/app/lib/energy';

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUSES = [
  'available', 'adopted', 'fostered', 'transferred',
  'deceased', 'escaped', 'quarantine', 'intake', 'hold',
] as const;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':   return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'adopted':     return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'fostered':    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'transferred': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'deceased':    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    case 'escaped':     return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'quarantine':  return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default:            return 'bg-gray-100 text-gray-800';
  }
};

// Simple inline SVG sparkline for weight history
function WeightSparkline({ logs }: { logs: WeightLog[] }) {
  const sorted = [...logs]
    .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
  if (sorted.length < 2) return null;

  const weights = sorted.map(l => Number(l.weight_kg));
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const W = 300, H = 64;
  const pad = 6;

  const pts = sorted.map((l, i) => {
    const x = pad + (i / (sorted.length - 1)) * (W - pad * 2);
    const y = H - pad - ((Number(l.weight_kg) - minW) / range) * (H - pad * 2);
    return { x, y, w: Number(l.weight_kg), d: l.measured_at };
  });

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" aria-hidden>
      <polyline
        points={polyline}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="hsl(var(--primary))">
          <title>{`${p.w} kg · ${new Date(p.d).toLocaleDateString()}`}</title>
        </circle>
      ))}
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AnimalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicalDialogOpen, setMedicalDialogOpen] = useState(false);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
  const [togglingDewormed, setTogglingDewormed] = useState(false);
  const [togglingAggressive, setTogglingAggressive] = useState(false);
  const [togglingAltered, setTogglingAltered] = useState(false);
  const [togglingPregnant, setTogglingPregnant] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [healthEvents, setHealthEvents] = useState<{ text: string; date: Date }[]>([]);
  const [behaviorNotes, setBehaviorNotes] = useState('');
  const [savingBehaviorNotes, setSavingBehaviorNotes] = useState(false);
  const [togglingSpecialNeeds, setTogglingSpecialNeeds] = useState(false);
  const [requestingAbortion, setRequestingAbortion] = useState(false);

  // Nav arrows
  const [animalIds, setAnimalIds] = useState<string[]>([]);

  // Expected litter date
  const [litterDateInput, setLitterDateInput] = useState('');
  const [savingLitterDate, setSavingLitterDate] = useState(false);

  // Weight
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [weightDate, setWeightDate] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const animalId = params.id as string;

  // Load animal + sibling IDs + weight history
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [data, listData, wLogs] = await Promise.all([
          ApiClient.getAnimal(animalId),
          ApiClient.getAnimals({ page_size: 200 }),
          ApiClient.getWeightHistory(animalId),
        ]);
        setAnimal(data);
        setAnimalIds(listData.items.map(a => a.id));
        setWeightLogs(wLogs);
        setBehaviorNotes(data.behavior_notes ?? '');
      } catch (error) {
        toast.error('Failed to load animal');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [animalId]);

  const currentIdx = animalIds.indexOf(animalId);
  const prevId = currentIdx > 0 ? animalIds[currentIdx - 1] : null;
  const nextId = currentIdx < animalIds.length - 1 ? animalIds[currentIdx + 1] : null;

  // Prefetch prev/next routes so navigation feels instant
  useEffect(() => {
    if (prevId) router.prefetch(`/dashboard/animals/${prevId}`);
    if (nextId) router.prefetch(`/dashboard/animals/${nextId}`);
  }, [prevId, nextId, router]);

  const handleAnimalUpdate = (updatedAnimal: Animal) => setAnimal(updatedAnimal);

  const toggleDewormed = async () => {
    if (!animal) return;
    setTogglingDewormed(true);
    try {
      const newVal = !animal.is_dewormed;
      const updated = await ApiClient.updateAnimal(animal.id, { is_dewormed: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? 'Odčervení: označeno jako provedené' : 'Odčervení: označeno jako neprovedené', date: new Date() },
        ...prev,
      ]);
    } catch { toast.error('Failed to update'); }
    finally { setTogglingDewormed(false); }
  };

  const toggleAggressive = async () => {
    if (!animal) return;
    setTogglingAggressive(true);
    try {
      const newVal = !animal.is_aggressive;
      const updated = await ApiClient.updateAnimal(animal.id, { is_aggressive: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? 'Agresivita: označena jako problematická' : 'Agresivita: označena jako v pořádku', date: new Date() },
        ...prev,
      ]);
    } catch { toast.error('Failed to update'); }
    finally { setTogglingAggressive(false); }
  };

  const toggleAltered = async () => {
    if (!animal) return;
    setTogglingAltered(true);
    try {
      const isCurrentlyAltered = animal.altered_status === 'neutered' || animal.altered_status === 'spayed';
      const newStatus = isCurrentlyAltered ? 'intact' : (animal.sex === 'female' ? 'spayed' : 'neutered');
      const updated = await ApiClient.updateAnimal(animal.id, { altered_status: newStatus } as any);
      setAnimal(updated);
      setHealthEvents((prev) => [
        { text: isCurrentlyAltered ? 'Kastrace: označena jako neprovedená' : 'Kastrace: označena jako provedená', date: new Date() },
        ...prev,
      ]);
    } catch {
      toast.error('Failed to update');
    } finally {
      setTogglingAltered(false);
    }
  };

  const togglePregnant = async () => {
    if (!animal) return;
    setTogglingPregnant(true);
    try {
      const newVal = !animal.is_pregnant;
      const updated = await ApiClient.updateAnimal(animal.id, { is_pregnant: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? 'Těhotenství: označeno' : 'Těhotenství: odznačeno', date: new Date() },
        ...prev,
      ]);
    } catch { toast.error('Failed to update'); }
    finally { setTogglingPregnant(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!animal) return;
    setChangingStatus(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, { status: newStatus } as any);
      setAnimal(updated);
      toast.success(`Status změněn na ${newStatus}`);
    } catch { toast.error('Nepodařilo se změnit status'); }
    finally { setChangingStatus(false); }
  };

  const handleLogWeight = async () => {
    if (!animal || !weightInput) return;
    const kg = parseFloat(weightInput);
    if (isNaN(kg) || kg <= 0) { toast.error('Zadejte platnou váhu'); return; }
    setSavingWeight(true);
    try {
      const measured_at = weightDate
        ? new Date(weightDate).toISOString()
        : undefined;
      const log = await ApiClient.logWeight(animal.id, kg, weightNotes || undefined, measured_at);
      setWeightLogs(prev => [log, ...prev].sort(
        (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
      ));
      setHealthEvents(prev => [
        { text: `Váha zaznamenána: ${kg} kg`, date: new Date() },
        ...prev,
      ]);
      toast.success(t('animals.health.weightAdded'));
      setWeightInput('');
      setWeightDate('');
      setWeightNotes('');
    } catch { toast.error(t('animals.health.weightError')); }
    finally { setSavingWeight(false); }
  };

  const handleSaveLitterDate = async () => {
    if (!animal || !litterDateInput) return;
    setSavingLitterDate(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, { expected_litter_date: litterDateInput } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: `Očekávaný termín vrhu: ${new Date(litterDateInput).toLocaleDateString()}`, date: new Date() },
        ...prev,
      ]);
      toast.success('Termín vrhu uložen');
      setLitterDateInput('');
    } catch { toast.error('Nepodařilo se uložit termín vrhu'); }
    finally { setSavingLitterDate(false); }
  };

  const toggleSpecialNeeds = async () => {
    if (!animal) return;
    setTogglingSpecialNeeds(true);
    try {
      const newVal = !animal.is_special_needs;
      const updated = await ApiClient.updateAnimal(animal.id, { is_special_needs: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? 'Speciální potřeby: označeny' : 'Speciální potřeby: odstraněny', date: new Date() },
        ...prev,
      ]);
    } catch { toast.error('Failed to update'); }
    finally { setTogglingSpecialNeeds(false); }
  };

  const handleRequestAbortion = async () => {
    if (!animal) return;
    if (!confirm(`Opravdu chcete vyžádat potrat pro ${animal.name}? Tato akce odstraní označení těhotenství a termín vrhu.`)) return;
    setRequestingAbortion(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, {
        is_pregnant: false,
        expected_litter_date: null,
      } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: 'Vyžádán potrat — těhotenství ukončeno', date: new Date() },
        ...prev,
      ]);
      toast.success('Potrat zaevidován, těhotenství odstraněno');
    } catch { toast.error('Nepodařilo se zaevidovat potrat'); }
    finally { setRequestingAbortion(false); }
  };

  const handleSaveBehaviorNotes = async () => {
    if (!animal) return;
    setSavingBehaviorNotes(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, { behavior_notes: behaviorNotes } as any);
      setAnimal(updated);
      toast.success('Poznámky k povaze uloženy');
    } catch { toast.error('Nepodařilo se uložit poznámky'); }
    finally { setSavingBehaviorNotes(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this animal?')) return;
    try {
      await ApiClient.deleteAnimal(animalId);
      toast.success('Animal deleted successfully');
      router.push('/dashboard/animals');
    } catch (error) {
      toast.error('Failed to delete animal');
      console.error(error);
    }
  };

  // Derived
  const days = animal?.intake_date
    ? Math.floor((Date.now() - new Date(animal.intake_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const intakeDateFormatted = animal?.intake_date
    ? new Date(animal.intake_date).toLocaleDateString()
    : null;

  const latestWeight = weightLogs.length > 0 ? weightLogs[0] : null;
  const weightKg = latestWeight
    ? Number(latestWeight.weight_kg)
    : (animal?.weight_current_kg ?? animal?.weight_estimated_kg ?? null);

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!animal) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/animals">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-3xl font-bold">Animal Not Found</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Animal not found</p>
            <Link href="/dashboard/animals"><Button className="mt-4">Back to Animals</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">

        {/* Photo + nav arrows */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className="relative w-full max-w-xs aspect-square rounded-xl overflow-hidden bg-muted mx-auto">
            <Image
              src={getAnimalImageUrl(animal)}
              alt={animal.name}
              fill
              className="object-cover object-center"
              unoptimized
            />
          </div>
          {/* Prev / Next arrows */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => prevId && router.push(`/dashboard/animals/${prevId}`)}
              disabled={!prevId}
              className="w-10 h-10 rounded-full border bg-background shadow hover:bg-accent transition-colors flex items-center justify-center disabled:opacity-30"
              aria-label="Předchozí zvíře"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs text-muted-foreground">
              {currentIdx >= 0 ? `${currentIdx + 1} / ${animalIds.length}` : ''}
            </span>
            <button
              onClick={() => nextId && router.push(`/dashboard/animals/${nextId}`)}
              disabled={!nextId}
              className="w-10 h-10 rounded-full border bg-background shadow hover:bg-accent transition-colors flex items-center justify-center disabled:opacity-30"
              aria-label="Další zvíře"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          {/* Back link */}
          <Link href="/dashboard/animals">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Zpět na seznam
            </Button>
          </Link>

          {/* Name + status inline */}
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start mb-1">
            <div className="flex-1 min-w-0">
              <EditableAnimalName animal={animal} onAnimalUpdate={handleAnimalUpdate} />
            </div>
            {/* Inline status select */}
            <Select value={animal.status} onValueChange={handleStatusChange} disabled={changingStatus}>
              <SelectTrigger className={`h-7 text-xs px-2 py-0 rounded-full border-0 w-auto min-w-[90px] ${getStatusColor(animal.status)}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Code + species */}
          <p className="text-muted-foreground mb-1">
            #{animal.public_code} · {animal.species}
            {animal.sex !== 'unknown' && ` · ${animal.sex === 'male' ? '♂' : '♀'}`}
          </p>

          {/* Days in shelter + kennel link — inline */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-3">
            {days !== null && (
              <span className="text-sm text-muted-foreground">
                <MapPin className="inline h-3.5 w-3.5 mr-0.5 mb-0.5" />
                {days} {days === 1 ? 'den' : days < 5 ? 'dny' : 'dní'} v útulku · od {intakeDateFormatted}
              </span>
            )}
            {animal.current_kennel_id ? (
              <Link
                href={`/dashboard/kennels/${animal.current_kennel_id}`}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                <MapPin className="inline h-3.5 w-3.5 mr-0.5 mb-0.5" />
                {animal.current_kennel_name} ({animal.current_kennel_code})
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">Bez kotce</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 justify-center sm:justify-start flex-wrap">
            <AssignKennelButton
              animal={animal}
              onAssigned={(kennel) => {
                setAnimal(prev => prev ? {
                  ...prev,
                  current_kennel_id: kennel?.id ?? null,
                  current_kennel_name: kennel?.name ?? null,
                  current_kennel_code: kennel?.code ?? null,
                } : null);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => setMedicalDialogOpen(true)}>
              <Stethoscope className="h-4 w-4 mr-2" />
              {t('medical.requestProcedure')}
            </Button>
            {animal.is_pregnant && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBirthDialogOpen(true)}
                className="border-pink-300 text-pink-700 hover:bg-pink-50 dark:border-pink-700 dark:text-pink-300"
              >
                <Baby className="h-4 w-4 mr-2" />
                Porod
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="feeding">Krmení</TabsTrigger>
          <TabsTrigger value="medical">Medical</TabsTrigger>
          <TabsTrigger value="behavior">Chování</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Core details about this animal (click edit buttons to modify)</CardDescription>
            </CardHeader>
            <CardContent>
              <EditableAnimalDetails animal={animal} onAnimalUpdate={handleAnimalUpdate} />
            </CardContent>
          </Card>

          {/* Health & Welfare */}
          <Card>
            <CardHeader>
              <CardTitle>{t('animals.health.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Neutered */}
              <div className="flex items-center gap-3">
                {animal.altered_status === 'neutered' || animal.altered_status === 'spayed' ? (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Scissors className="h-4 w-4 text-green-600" />
                  </div>
                ) : animal.altered_status === 'intact' ? (
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <HelpCircle className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                <span className="text-sm font-medium">{t('animals.health.neutered')}</span>
                <button
                  className="ml-auto text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={toggleAltered}
                  disabled={togglingAltered || animal.is_pregnant}
                  title={animal.is_pregnant ? 'Kastrace není možná u těhotného zvířete' : t('animals.health.toggleAltered')}
                >
                  {togglingAltered ? '...' : (animal.altered_status === 'neutered' || animal.altered_status === 'spayed' ? t('animals.health.markIntact') : t('animals.health.markAltered'))}
                </button>
                {animal.is_pregnant && (
                  <span className="text-xs text-amber-600 ml-1" title="Kastrace není možná u těhotného zvířete">⚠ těhotná</span>
                )}
              </div>

              {/* Dewormed */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${animal.is_dewormed ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Pill className={`h-4 w-4 ${animal.is_dewormed ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <span className="text-sm font-medium">{t('animals.health.dewormed')}</span>
                <button
                  className="ml-auto text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                  onClick={toggleDewormed}
                  disabled={togglingDewormed}
                  title={t('animals.health.toggleDewormed')}
                >
                  {animal.is_dewormed ? t('animals.health.yes') : t('animals.health.no')}
                </button>
              </div>

              {/* Aggressive */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${animal.is_aggressive ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <AlertTriangle className={`h-4 w-4 ${animal.is_aggressive ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <span className="text-sm font-medium">{t('animals.health.aggressive')}</span>
                <button
                  className="ml-auto text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                  onClick={toggleAggressive}
                  disabled={togglingAggressive}
                  title={t('animals.health.toggleAggressive')}
                >
                  {animal.is_aggressive ? t('animals.health.aggressiveWarning') : t('animals.health.no')}
                </button>
              </div>

              {/* Pregnant */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${animal.is_pregnant ? 'bg-pink-100' : 'bg-gray-100'}`}>
                  <Baby className={`h-4 w-4 ${animal.is_pregnant ? 'text-pink-500' : 'text-gray-400'}`} />
                </div>
                <span className="text-sm font-medium">{t('animals.health.pregnant')}</span>
                <button
                  className="ml-auto text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                  onClick={togglePregnant}
                  disabled={togglingPregnant}
                  title={t('animals.health.togglePregnant')}
                >
                  {animal.is_pregnant ? t('animals.health.yes') : t('animals.health.no')}
                </button>
              </div>

              {/* Abortion request — only when pregnant */}
              {animal.is_pregnant && (
                <div className="ml-11 flex items-center gap-2 py-1 border-t border-dashed border-pink-200">
                  <span className="text-xs text-muted-foreground">Veterinární zákrok:</span>
                  <button
                    className="text-xs px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                    onClick={handleRequestAbortion}
                    disabled={requestingAbortion}
                    title="Vyžádat provedení potratu — odstraní označení těhotenství"
                  >
                    {requestingAbortion ? 'Zpracovávám…' : '🚫 Vyžádat potrat'}
                  </button>
                </div>
              )}

              {/* Special needs */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${animal.is_special_needs ? 'bg-violet-100' : 'bg-gray-100'}`}>
                  <Accessibility className={`h-4 w-4 ${animal.is_special_needs ? 'text-violet-600' : 'text-gray-400'}`} />
                </div>
                <span className="text-sm font-medium">Speciální potřeby</span>
                <button
                  className="ml-auto text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                  onClick={toggleSpecialNeeds}
                  disabled={togglingSpecialNeeds}
                  title="Zvíře má speciální potřeby (handicap, zdravotní omezení...)"
                >
                  {togglingSpecialNeeds ? '...' : (animal.is_special_needs ? 'Ano' : 'Ne')}
                </button>
              </div>

              {/* Expected litter date (shown when pregnant) */}
              {animal.is_pregnant && (
                <div className="ml-11 space-y-1">
                  {animal.expected_litter_date && (
                    <p className="text-sm text-pink-700 dark:text-pink-300 font-medium">
                      Očekávaný termín vrhu: {new Date(animal.expected_litter_date).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={litterDateInput || (animal.expected_litter_date ?? '')}
                      onChange={e => setLitterDateInput(e.target.value)}
                      className="h-7 text-xs w-36"
                      title="Očekávaný termín vrhu"
                    />
                    <button
                      className="text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                      onClick={handleSaveLitterDate}
                      disabled={savingLitterDate || !litterDateInput}
                    >
                      {savingLitterDate ? 'Ukládám…' : 'Uložit termín'}
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weight */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                {t('animals.health.weight')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Latest weight */}
              {latestWeight ? (
                <div>
                  <p className="text-2xl font-bold">
                    {Number(latestWeight.weight_kg).toFixed(1)} kg
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(latestWeight.measured_at).toLocaleDateString()}
                    {latestWeight.notes && ` · ${latestWeight.notes}`}
                  </p>
                  {/* Energy needs */}
                  <p
                    className="text-sm text-muted-foreground mt-1"
                    title="RER = 70 × kg^0.75, MER = RER × faktor aktivity/kastrace"
                  >
                    ⚡ {t('animals.health.energyNeeds')}: ~{calcMER(
                      Number(latestWeight.weight_kg),
                      animal.age_group,
                      animal.altered_status,
                      animal.is_pregnant,
                    )} kcal/den
                  </p>
                </div>
              ) : weightKg ? (
                <div>
                  <p className="text-2xl font-bold">{Number(weightKg).toFixed(1)} kg</p>
                  <p className="text-xs text-muted-foreground">odhadovaná váha</p>
                  <p
                    className="text-sm text-muted-foreground mt-1"
                    title="RER = 70 × kg^0.75, MER = RER × faktor aktivity/kastrace"
                  >
                    ⚡ {t('animals.health.energyNeeds')}: ~{calcMER(
                      Number(weightKg),
                      animal.age_group,
                      animal.altered_status,
                      animal.is_pregnant,
                    )} kcal/den
                  </p>
                </div>
              ) : null}

              {/* Chart */}
              {weightLogs.length >= 2 ? (
                <div className="border rounded-lg p-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-2">{t('animals.health.weightHistory')}</p>
                  <WeightSparkline logs={weightLogs} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{new Date(weightLogs[weightLogs.length - 1].measured_at).toLocaleDateString()}</span>
                    <span>{new Date(weightLogs[0].measured_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ) : weightLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('animals.health.weightFirstMeasurement')}</p>
              ) : null}

              {/* Add measurement form */}
              <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
                <p className="text-xs font-medium text-muted-foreground">{t('animals.health.addWeight')}</p>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="999"
                    placeholder={t('animals.health.weightKg')}
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                  <Input
                    type="date"
                    value={weightDate}
                    onChange={e => setWeightDate(e.target.value)}
                    className="w-36 h-8 text-sm"
                    title={t('animals.health.weightDate')}
                  />
                  <Input
                    type="text"
                    placeholder={t('animals.health.weightNotes')}
                    value={weightNotes}
                    onChange={e => setWeightNotes(e.target.value)}
                    className="flex-1 min-w-[120px] h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleLogWeight}
                    disabled={savingWeight || !weightInput}
                  >
                    {savingWeight ? t('animals.health.weightSaving') : t('animals.health.weightSave')}
                  </Button>
                </div>
              </div>

              {/* Log table */}
              {weightLogs.length > 0 && (
                <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {weightLogs.map(log => (
                    <div key={log.id} className="flex justify-between gap-2 py-0.5 border-b border-border/40 last:border-0">
                      <span>{Number(log.weight_kg).toFixed(1)} kg</span>
                      <span className="text-muted-foreground">{new Date(log.measured_at).toLocaleDateString()}</span>
                      <span className="text-muted-foreground truncate">{log.notes ?? ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Feeding ── */}
        <TabsContent value="feeding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Energetické potřeby (RER/MER)</CardTitle>
              <CardDescription>
                Vědecky podložené doporučení dávkování krmiva na základě váhy, věku, kastrace a podmínek chovu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MERCalculator
                animalId={animalId}
                weightKg={weightKg}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Timeline ── */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Activity history for this animal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6">
                <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-border" />

                {healthEvents.map((ev, i) => (
                  <div key={i} className="relative mb-6">
                    <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-blue-400 border-2 border-background" />
                    <div className="pl-2">
                      <p className="text-sm font-semibold">{ev.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.date.toLocaleTimeString()} · {ev.date.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Expected litter date – shown in timeline even if in the future */}
                {animal.expected_litter_date && (
                  <div className="relative mb-6">
                    <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-pink-400 border-2 border-background" />
                    <div className="pl-2">
                      <p className="text-sm font-semibold text-pink-700 dark:text-pink-300">
                        Očekávaný termín vrhu
                        {new Date(animal.expected_litter_date) > new Date() && ' (v budoucnosti)'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(animal.expected_litter_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {animal.intake_date && (
                  <div className="relative mb-6">
                    <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
                    <div className="pl-2">
                      <p className="text-sm font-semibold">Příjem do útulku</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(animal.intake_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="relative mb-6">
                  <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-background" />
                  <div className="pl-2">
                    <p className="text-sm font-semibold">Záznam vytvořen v systému</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(animal.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  {/* TODO: M4 - load full event history from API */}
                  Plná historie událostí bude přidána v M4.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Medical ── */}
        <TabsContent value="medical">
          <Card>
            <CardHeader>
              <CardTitle>Medical Records</CardTitle>
              <CardDescription>Health history and medical procedures</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">Medical records coming in M4</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Behavior ── */}
        <TabsContent value="behavior">
          <Card>
            <CardHeader>
              <CardTitle>Povaha a chování</CardTitle>
              <CardDescription>Co má rád, nerad, čeho se bojí a další poznámky k povaze zvířete</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full min-h-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                placeholder="Co má rád, nerad, čeho se bojí..."
                value={behaviorNotes}
                onChange={e => setBehaviorNotes(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveBehaviorNotes}
                  disabled={savingBehaviorNotes}
                >
                  {savingBehaviorNotes ? 'Ukládám…' : 'Uložit'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Files and attachments</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">Documents coming in M5+</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Deceased zone – de-emphasized, at the bottom ── */}
      {animal.status !== 'deceased' && (
        <div className="pt-8 border-t border-dashed">
          <div className="relative inline-block">
            <button
              className="text-xs text-muted-foreground/50 hover:text-red-500 transition-colors px-3 py-1.5 rounded border border-dashed border-muted-foreground/20 hover:border-red-300"
              onClick={async () => {
                if (!confirm(`Opravdu chcete zaevidovat úmrtí zvířete ${animal.name}? Tato akce změní status na "Uhynul/a".`)) return;
                try {
                  const updated = await ApiClient.updateAnimal(animal.id, { status: 'deceased' } as any);
                  setAnimal(updated);
                  setHealthEvents(prev => [{ text: 'Zaevidováno úmrtí', date: new Date() }, ...prev]);
                  toast.success('Úmrtí zaevidováno');
                  setTimeout(() => toast.info('Byl automaticky vytvořen úkol na likvidaci těla.'), 800);
                } catch { toast.error('Nepodařilo se zaevidovat úmrtí'); }
              }}
            >
              Zaevidovat úmrtí
            </button>
            {/* Diagonal mourning stripe */}
            <span
              className="absolute inset-0 pointer-events-none rounded overflow-hidden"
              aria-hidden
            >
              <span className="absolute inset-0 opacity-20"
                style={{
                  background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.3) 4px, rgba(0,0,0,0.3) 5px)',
                }}
              />
            </span>
          </div>
        </div>
      )}

      {/* Medical Request Dialog */}
      {animal && (
        <RequestMedicalProcedureDialog
          animal={animal}
          open={medicalDialogOpen}
          onOpenChange={setMedicalDialogOpen}
        />
      )}

      {/* Birth Dialog */}
      {animal && (
        <BirthDialog
          animalId={animal.id}
          animalName={animal.name}
          open={birthDialogOpen}
          onOpenChange={setBirthDialogOpen}
          onBirthRegistered={(count) => {
            setAnimal(prev => prev ? { ...prev, is_pregnant: false, expected_litter_date: null } : null);
            setHealthEvents(prev => [
              { text: `Porod: zaevidováno ${count} mláďat`, date: new Date() },
              ...prev,
            ]);
          }}
        />
      )}
    </div>
  );
}
