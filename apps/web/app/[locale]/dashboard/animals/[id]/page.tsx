'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft, Trash2, MapPin, Loader2, Stethoscope,
  CheckCircle2, XCircle, HelpCircle, AlertTriangle, Pill, Scissors,
  ChevronLeft, ChevronRight, Baby, Scale, Accessibility, Home, Camera,
  PersonStanding, LogIn, CheckCheck, FileText, Upload, X, ExternalLink,
  QrCode, Globe, UserCheck, Clock, Edit2, Info,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'react-qr-code';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import ApiClient, { Animal, WeightLog, MERCalculation } from '@/app/lib/api';
import MERCalculator from '@/app/components/feeding/MERCalculator';
import { getAnimalImageUrl } from '@/app/lib/utils';
import { toast } from 'sonner';
import RequestMedicalProcedureDialog from '@/app/components/animals/RequestMedicalProcedureDialog';
import BirthDialog from '@/app/components/animals/BirthDialog';
import CreateDocumentDialog from '@/app/components/documents/CreateDocumentDialog';
import { EditableAnimalName, EditableAnimalDetails, AssignKennelButton } from '@/app/components/animals';
import { calcMER, calcRER, getMERFactor, getMERFactorLabel } from '@/app/lib/energy';
import { useAuth } from '@/app/context/AuthContext';
import { useOrganizationStore } from '@/app/stores/organizationStore';
import PersonalityTab from '@/app/components/animals/PersonalityTab';
import PassportTab from '@/app/components/animals/PassportTab';

// ── Helpers ────────────────────────────────────────────────────────────────

// 'escaped' is intentionally excluded — use the Escape button to record an escape incident
const STATUSES = [
  'available', 'reserved', 'adopted', 'fostered', 'transferred',
  'deceased', 'quarantine', 'intake', 'hold', 'waiting_adoption',
] as const;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'registered':  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    case 'available':   return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'reserved':    return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    case 'adopted':     return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'fostered':    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'transferred': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'deceased':    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    case 'escaped':     return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'quarantine':  return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'waiting_adoption': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
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
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
  const avgY = H - pad - ((avg - minW) / range) * (H - pad * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" aria-hidden>
      <line
        x1={pad} y1={avgY} x2={W - pad} y2={avgY}
        stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth="1" opacity="0.5"
      />
      <text x={W - pad + 2} y={avgY + 4} fontSize="9" fill="hsl(var(--muted-foreground))">{avg.toFixed(1)}</text>
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
  const t = useTranslations('animals');
  const { user } = useAuth();
  const { selectedOrg } = useOrganizationStore();
  const isSuperadmin = user?.is_superadmin === true;

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingWeight, setLoadingWeight] = useState(false);
  const [loadingKennelHistory, setLoadingKennelHistory] = useState(false);
  const [loadingVaccinations, setLoadingVaccinations] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [loadingIntakes, setLoadingIntakes] = useState(false);
  const [medicalDialogOpen, setMedicalDialogOpen] = useState(false);
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [togglingDewormed, setTogglingDewormed] = useState(false);
  const [togglingAggressive, setTogglingAggressive] = useState(false);
  const [togglingAltered, setTogglingAltered] = useState(false);
  const [togglingPregnant, setTogglingPregnant] = useState(false);
  const [togglingLactating, setTogglingLactating] = useState(false);
  const [togglingCritical, setTogglingCritical] = useState(false);
  const [togglingDiabetic, setTogglingDiabetic] = useState(false);
  const [togglingCancer, setTogglingCancer] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [healthEvents, setHealthEvents] = useState<{ text: string; date: Date }[]>([]);
  const [behaviorNotes, setBehaviorNotes] = useState('');
  const [savingBehaviorNotes, setSavingBehaviorNotes] = useState(false);
  const [togglingSpecialNeeds, setTogglingSpecialNeeds] = useState(false);
  const [requestingAbortion, setRequestingAbortion] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Close intake dialog
  const [closeIntakeOpen, setCloseIntakeOpen] = useState(false);
  const [closeIntakeOutcome, setCloseIntakeOutcome] = useState<'adopted' | 'deceased' | 'lost' | 'hotel_end'>('adopted');
  const [closeIntakeNotes, setCloseIntakeNotes] = useState('');
  const [closingIntake, setClosingIntake] = useState(false);
  const [activeIntakeId, setActiveIntakeId] = useState<string | null>(null);
  const [activeIntakeReason, setActiveIntakeReason] = useState<string | null>(null);

// Escape dialog
  const [escapeOpen, setEscapeOpen] = useState(false);
  const [escapeNotes, setEscapeNotes] = useState('');

  // Superadmin: intake date edit
  const [editingIntakeDate, setEditingIntakeDate] = useState(false);
  const [intakeDateInput, setIntakeDateInput] = useState('');
  const [savingIntakeDate, setSavingIntakeDate] = useState(false);

  // Legal deadline editing
  const [editingLegalDeadline, setEditingLegalDeadline] = useState(false);
  const [legalDeadlineForm, setLegalDeadlineForm] = useState({
    notice_published_at: '',
    finder_claims_ownership: '' as '' | 'true' | 'false',
    municipality_irrevocably_transferred: '' as '' | 'true' | 'false',
  });
  const [savingLegalDeadline, setSavingLegalDeadline] = useState(false);

  // Website publication
  const [publishing, setPublishing] = useState(false);
  const [editingWebsiteDeadline, setEditingWebsiteDeadline] = useState(false);
  const [websiteDeadlineForm, setWebsiteDeadlineForm] = useState({
    published_at: '',
    deadline_at: '',
  });
  const [savingWebsiteDeadline, setSavingWebsiteDeadline] = useState(false);

  // Return to original owner
  const [returnToOwnerDialogOpen, setReturnToOwnerDialogOpen] = useState(false);
  const [returnToOwnerForm, setReturnToOwnerForm] = useState({
    return_date: '',
    notes: '',
  });
  const [savingReturnToOwner, setSavingReturnToOwner] = useState(false);

  // Superadmin: delete stay
  const [deletingStay, setDeletingStay] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [escapeDate, setEscapeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recordingEscape, setRecordingEscape] = useState(false);

  // Found after escape dialog
  const [foundOpen, setFoundOpen] = useState(false);
  const [foundNotes, setFoundNotes] = useState('');
  const [foundDate, setFoundDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recordingFound, setRecordingFound] = useState(false);

  const queryClient = useQueryClient();

  // Nav arrows — initialise from cache so arrows are visible immediately on navigation
  const [animalIds, setAnimalIds] = useState<string[]>(
    () => queryClient.getQueryData<string[]>(['animalIds']) ?? []
  );

  // Expected litter date
  const [litterDateInput, setLitterDateInput] = useState('');
  const [savingLitterDate, setSavingLitterDate] = useState(false);

  // Weight
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [weightDate, setWeightDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weightNotes, setWeightNotes] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  // Kennel history
  const [kennelHistory, setKennelHistory] = useState<{ kennel_code: string; assigned_at: string; released_at: string | null }[]>([]);
  const animalId = params.id as string;
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !animal) return;
    setUploadingPhoto(true);
    try {
      const result = await ApiClient.uploadAnimalPhoto(animal.id, file);
      setAnimal(prev => prev ? { ...prev, primary_photo_url: result.thumbnail_url || result.file_url } : prev);
      toast.success('Fotka nahrána');
    } catch (err: any) {
      toast.error('Nepodařilo se nahrát fotku: ' + (err.message || ''));
    } finally {
      setUploadingPhoto(false);
if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !animal) return;
    setUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await ApiClient.post(`/files/animal/${animal.id}/upload-document`, formData);
      setDocuments(prev => [result, ...prev]);
      toast.success('Dokument nahrán');
    } catch (err: any) {
      toast.error('Nepodařilo se nahrát dokument: ' + (err.message || ''));
    } finally {
      setUploadingDocument(false);
      if (documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Opravdu chcete smazat tento dokument?')) return;
    try {
      await ApiClient.delete(`/files/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast.success('Dokument smazán');
    } catch (err: any) {
      toast.error('Nepodařilo se smazat dokument: ' + (err.message || ''));
    }
  };

  // Load animal + sibling IDs + weight history
  useEffect(() => {
    console.log('[ANIMAL_DETAIL] Page loaded, animalId:', animalId, 'params:', params);
    const fetchAll = async () => {
      try {
        console.log('[ANIMAL_DETAIL] Fetching data for animalId:', animalId);
        // Check cache first — show immediately if available
        const cached = queryClient.getQueryData<Animal>(['animal', animalId]);
        if (cached) {
          setAnimal(cached);
          setBehaviorNotes(cached.behavior_notes ?? '');
          setLoading(false);
        } else {
          setLoading(true);
        }

        const [data, idsData] = await Promise.all([
          ApiClient.getAnimal(animalId),
          ApiClient.getAnimalIds(),
        ]);
        // Store fresh data back in cache
        queryClient.setQueryData(['animal', data.id], data);
        queryClient.setQueryData(['animalIds'], idsData);
        setAnimal(data);
        setAnimalIds(idsData);
        setBehaviorNotes(data.behavior_notes ?? '');
        
        // Load additional data in background with loading states
        setLoadingWeight(true);
        setLoadingKennelHistory(true);
        setLoadingIntakes(true);
        setLoadingVaccinations(true);
        
        const [wLogs, kHistory, intakes, vacs] = await Promise.all([
          ApiClient.getWeightHistory(animalId).catch(() => []),
          ApiClient.getAnimalKennelHistory(animalId).catch(() => []),
          ApiClient.get('/intakes', { animal_id: animalId }).catch(() => []),
          ApiClient.get(`/vaccinations/animal/${animalId}`).catch(() => ({ items: [] })),
        ]);
        setWeightLogs(wLogs);
        setKennelHistory(kHistory);
        const activeIntake = Array.isArray(intakes) ? intakes[0] : null;
        setActiveIntakeId(activeIntake?.id ?? null);
        setActiveIntakeReason(activeIntake?.reason ?? null);
        setVaccinations(vacs.items || []);
        
        setLoadingWeight(false);
        setLoadingKennelHistory(false);
        setLoadingIntakes(false);
        setLoadingVaccinations(false);
      } catch (error) {
        toast.error(t('loadError'));
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

  // Prefetch prev/next routes + API data so navigation feels instant
  useEffect(() => {
    [prevId, nextId].forEach(id => {
      if (!id) return;
      router.prefetch(`/dashboard/animals/${id}`);
      queryClient.prefetchQuery({
        queryKey: ['animal', id],
        queryFn: () => ApiClient.getAnimal(id),
        staleTime: 30_000,
      });
    });
}, [prevId, nextId, router, queryClient]);

  // Load documents when animal is loaded
  useEffect(() => {
    if (!animal?.id) return;
    const loadDocuments = async () => {
      setLoadingDocuments(true);
      try {
        const docs = await ApiClient.get(`/files/animal/${animal.id}/documents`);
        setDocuments(docs || []);
      } catch {
        setDocuments([]);
      } finally {
        setLoadingDocuments(false);
      }
    };
    loadDocuments();
  }, [animal?.id]);

  const handleAnimalUpdate = (updatedAnimal: Animal) => setAnimal(updatedAnimal);

  const toggleDewormed = async () => {
    if (!animal) return;
    setTogglingDewormed(true);
    try {
      const newVal = !animal.is_dewormed;
      const updated = await ApiClient.updateAnimal(animal.id, { is_dewormed: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? t('healthEvents.dewormedOn') : t('healthEvents.dewormedOff'), date: new Date() },
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
        { text: newVal ? t('healthEvents.aggressiveOn') : t('healthEvents.aggressiveOff'), date: new Date() },
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
        { text: isCurrentlyAltered ? t('healthEvents.alteredOff') : t('healthEvents.alteredOn'), date: new Date() },
        ...prev,
      ]);
      // Neutering changes the MER activity factor — remind user to recalculate
      if (!isCurrentlyAltered) {
        setTimeout(() => toast.info(t('mer.recalculateAfterAltering')), 600);
      }
    } catch {
      toast.error('Failed to update');
    } finally {
      setTogglingAltered(false);
    }
  };

  const togglePregnant = async () => {
    if (!animal) return;
    if (animal.sex === 'male') return;
    setTogglingPregnant(true);
    try {
      const newVal = !animal.is_pregnant;
      const updated = await ApiClient.updateAnimal(animal.id, { is_pregnant: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? t('healthEvents.pregnantOn') : t('healthEvents.pregnantOff'), date: new Date() },
        ...prev,
      ]);
    } catch { toast.error('Failed to update'); }
    finally { setTogglingPregnant(false); }
  };

  const toggleLactating = async () => {
    if (!animal) return;
    if (animal.sex === 'male') return;
    setTogglingLactating(true);
    try {
      const newVal = !animal.is_lactating;
      const updated = await ApiClient.updateAnimal(animal.id, { is_lactating: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? t('healthEvents.lactatingOn') : t('healthEvents.lactatingOff'), date: new Date() },
        ...prev,
      ]);
      // Recalculate and show MER
      if (latestWeight?.weight_kg) {
        const newMER = calcMER(
          Number(latestWeight.weight_kg),
          animal.age_group,
          animal.altered_status,
          animal.is_pregnant,
          newVal,
          animal.is_critical,
          animal.is_diabetic,
          animal.is_cancer,
          animal.species
        );
        toast.success(t('merUpdated', { value: newMER }));
      }
    } catch { toast.error('Failed to update'); }
    finally { setTogglingLactating(false); }
  };

  const toggleCritical = async () => {
    if (!animal) return;
    setTogglingCritical(true);
    try {
      const newVal = !animal.is_critical;
      const updated = await ApiClient.updateAnimal(animal.id, { is_critical: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? t('healthEvents.criticalOn') : t('healthEvents.criticalOff'), date: new Date() },
        ...prev,
      ]);
      // Recalculate and show MER
      if (latestWeight?.weight_kg) {
        const newMER = calcMER(
          Number(latestWeight.weight_kg),
          animal.age_group,
          animal.altered_status,
          animal.is_pregnant,
          animal.is_lactating,
          newVal,
          animal.is_diabetic,
          animal.is_cancer,
          animal.species
        );
        toast.success(t('merUpdated', { value: newMER }));
      }
    } catch { toast.error('Failed to update'); }
    finally { setTogglingCritical(false); }
  };

  const toggleDiabetic = async () => {
    if (!animal) return;
    setTogglingDiabetic(true);
    try {
      const newVal = !animal.is_diabetic;
      const updated = await ApiClient.updateAnimal(animal.id, { is_diabetic: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? t('healthEvents.diabeticOn') : t('healthEvents.diabeticOff'), date: new Date() },
        ...prev,
      ]);
      // Recalculate and show MER
      if (latestWeight?.weight_kg) {
        const newMER = calcMER(
          Number(latestWeight.weight_kg),
          animal.age_group,
          animal.altered_status,
          animal.is_pregnant,
          animal.is_lactating,
          animal.is_critical,
          newVal,
          animal.is_cancer,
          animal.species
        );
        toast.success(t('merUpdated', { value: newMER }));
      }
    } catch { toast.error('Failed to update'); }
    finally { setTogglingDiabetic(false); }
  };

  const toggleCancer = async () => {
    if (!animal) return;
    setTogglingCancer(true);
    try {
      const newVal = !animal.is_cancer;
      const updated = await ApiClient.updateAnimal(animal.id, { is_cancer: newVal } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: newVal ? t('healthEvents.cancerOn') : t('healthEvents.cancerOff'), date: new Date() },
        ...prev,
      ]);
      // Recalculate and show MER
      if (latestWeight?.weight_kg) {
        const newMER = calcMER(
          Number(latestWeight.weight_kg),
          animal.age_group,
          animal.altered_status,
          animal.is_pregnant,
          animal.is_lactating,
          animal.is_critical,
          animal.is_diabetic,
          newVal,
          animal.species
        );
        toast.success(t('merUpdated', { value: newMER }));
      }
    } catch { toast.error('Failed to update'); }
    finally { setTogglingCancer(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!animal) return;
    setChangingStatus(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, { status: newStatus } as any);
      setAnimal(updated);
      toast.success(t('overview.statusChanged', { status: newStatus }));
      // Escaped animals are automatically removed from their kennel
      if (newStatus === 'escaped' && animal.current_kennel_id) {
        try {
          await ApiClient.moveAnimal({ animal_id: animal.id, target_kennel_id: null });
          setAnimal(prev => prev ? { ...prev, current_kennel_id: null, current_kennel_name: null, current_kennel_code: null } : prev);
          toast.info(t('overview.removedFromKennel'));
        } catch { /* kennel removal failed silently — not critical */ }
      }
    } catch { toast.error(t('overview.statusChangeError')); }
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
        { text: t('healthEvents.weightRecorded', { weight: kg }), date: new Date() },
        ...prev,
      ]);
      toast.success(t('health.weightAdded'));
      setWeightInput('');
      setWeightDate(new Date().toISOString().split('T')[0]);
      setWeightNotes('');
    } catch { toast.error(t('health.weightError')); }
    finally { setSavingWeight(false); }
  };

  const handleSaveLitterDate = async () => {
    if (!animal || !litterDateInput) return;
    setSavingLitterDate(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, { expected_litter_date: litterDateInput } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: t('healthEvents.litterDate', { date: new Date(litterDateInput).toLocaleDateString() }), date: new Date() },
        ...prev,
      ]);
      toast.success(t('pregnancy.litterDateSaved'));
      setLitterDateInput('');
    } catch { toast.error(t('pregnancy.litterDateError')); }
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
        { text: newVal ? t('healthEvents.specialNeedsOn') : t('healthEvents.specialNeedsOff'), date: new Date() },
        ...prev,
      ]);
    } catch { toast.error('Failed to update'); }
    finally { setTogglingSpecialNeeds(false); }
  };

  const handleRequestAbortion = async () => {
    if (!animal) return;
    if (!confirm(t('pregnancy.confirmAbortion', { name: animal.name }))) return;
    setRequestingAbortion(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, {
        is_pregnant: false,
        expected_litter_date: null,
      } as any);
      setAnimal(updated);
      setHealthEvents(prev => [
        { text: t('pregnancy.abortionRecorded'), date: new Date() },
        ...prev,
      ]);
      toast.success(t('pregnancy.abortionRecorded'));
    } catch { toast.error(t('pregnancy.abortionError')); }
    finally { setRequestingAbortion(false); }
  };

  const handleSaveBehaviorNotes = async () => {
    if (!animal) return;
    setSavingBehaviorNotes(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, { behavior_notes: behaviorNotes } as any);
      setAnimal(updated);
      toast.success(t('behavior.saved'));
    } catch { toast.error(t('behavior.saveError')); }
    finally { setSavingBehaviorNotes(false); }
  };

  const handleDelete = async () => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await ApiClient.deleteAnimal(animalId);
      toast.success(t('deleteSuccess'));
      router.push('/dashboard/animals');
    } catch (error) {
      toast.error(t('deleteError'));
      console.error(error);
    }
  };

  const handleCloseIntake = async () => {
    if (!activeIntakeId) return;
    setClosingIntake(true);
    try {
      await ApiClient.closeIntake(activeIntakeId, { outcome: closeIntakeOutcome, notes: closeIntakeNotes || undefined });
      toast.success(t('intake.closeSuccess'));
      setCloseIntakeOpen(false);
      setActiveIntakeId(null);
      setActiveIntakeReason(null);
      // Refresh animal to get updated status
      const updated = await ApiClient.getAnimal(animalId);
      setAnimal(updated);
    } catch (err: any) {
      toast.error(t('intake.closeError'));
    } finally {
      setClosingIntake(false);
    }
  };

  const handleEscape = async () => {
    if (!animal) return;
    setRecordingEscape(true);
    try {
      await ApiClient.createIncident({
        animal_id: animal.id,
        incident_type: 'escape',
        incident_date: escapeDate,
        description: escapeNotes || undefined,
      });
      toast.success(t('escape.recorded'));
      setEscapeOpen(false);
      setEscapeNotes('');
      // Refresh animal (status will be set to 'escaped' by the backend)
      const updated = await ApiClient.getAnimal(animalId);
      setAnimal(updated);
    } catch {
      toast.error(t('escape.recordError'));
    } finally {
      setRecordingEscape(false);
    }
  };

  const handleFound = async () => {
    if (!animal) return;
    setRecordingFound(true);
    try {
      await ApiClient.createIncident({
        animal_id: animal.id,
        incident_type: 'found',
        incident_date: foundDate,
        description: foundNotes || undefined,
      });
      await ApiClient.updateAnimal(animal.id, { status: 'intake' } as any);
      toast.success(t('escape.foundRecorded'));
      setFoundOpen(false);
      setFoundNotes('');
      const updated = await ApiClient.getAnimal(animalId);
      setAnimal(updated);
    } catch {
      toast.error(t('escape.recordError'));
    } finally {
      setRecordingFound(false);
    }
  };

  const handleSaveIntakeDate = async () => {
    if (!animal || !intakeDateInput) return;
    setSavingIntakeDate(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, { intake_date: intakeDateInput } as any);
      setAnimal(updated);
      toast.success('Datum příjmu aktualizováno');
      setEditingIntakeDate(false);
    } catch (e: any) {
      toast.error(e.message || 'Chyba při ukládání');
    } finally {
      setSavingIntakeDate(false);
    }
  };

  const handleSaveLegalDeadline = async () => {
    if (!animal) return;
    setSavingLegalDeadline(true);
    try {
      // Find the intake ID for this animal
      const intakes = await ApiClient.get('/intakes', { animal_id: animal.id });
      const activeIntake = Array.isArray(intakes) && intakes.length > 0 ? intakes[0] : null;
      
      if (!activeIntake?.id) {
        toast.error('Neexistuje intake záznam');
        return;
      }

      await ApiClient.patch(`/intakes/${activeIntake.id}`, {
        notice_published_at: legalDeadlineForm.notice_published_at || null,
        finder_claims_ownership: legalDeadlineForm.finder_claims_ownership === '' ? null : legalDeadlineForm.finder_claims_ownership === 'true',
        municipality_irrevocably_transferred: legalDeadlineForm.municipality_irrevocably_transferred === '' ? null : legalDeadlineForm.municipality_irrevocably_transferred === 'true',
      });
      
      // Refresh animal data
      const updated = await ApiClient.getAnimal(animal.id);
      setAnimal(updated);
      toast.success('Nálezové lhůty aktualizovány');
      setEditingLegalDeadline(false);
    } catch (e: any) {
      toast.error(e.message || 'Chyba při ukládání');
    } finally {
      setSavingLegalDeadline(false);
    }
  };

  const startEditLegalDeadline = () => {
    if (!animal) return;
    setLegalDeadlineForm({
      notice_published_at: animal.notice_published_at?.split('T')[0] || '',
      finder_claims_ownership: animal.finder_claims_ownership === null ? '' : animal.finder_claims_ownership ? 'true' : 'false',
      municipality_irrevocably_transferred: animal.municipality_irrevocably_transferred === null ? '' : animal.municipality_irrevocably_transferred ? 'true' : 'false',
    });
    setEditingLegalDeadline(true);
  };

  const handleDeleteCurrentStay = async () => {
    if (!animal || !animal.current_kennel_id) return;
    if (!confirm('Opravdu chcete smazat aktuální pobyt v kotci? Tato akce je nevratná.')) return;
    setDeletingStay(true);
    try {
      // Note: We'd need the stay ID here - for simplicity, we'll skip this for now
      // In a real implementation, you'd get the stay ID from the stays list
      toast.error('Nejprve ukončete pobyt v kotci (Close Intake)');
    } catch (e: any) {
      toast.error(e.message || 'Chyba při mazání');
    } finally {
      setDeletingStay(false);
    }
  };

  const handlePublishToWebsite = async () => {
    if (!animal) return;

    // Confirm dialog
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + 4);
    const confirmed = window.confirm(
      `Opravdu chcete vystavit ${animal.name} na web? Běžet začne 4měsíční čekací lhůta (do ${deadline.toLocaleDateString('cs-CZ')}).`
    );

    if (!confirmed) return;

    setPublishing(true);
    try {
      const updated = await ApiClient.publishAnimalToWebsite(animal.id);
      setAnimal(updated);
      toast.success(
        `Zvíře vystaveno na webu. Lhůta vyprší ${new Date(updated.website_deadline_at!).toLocaleDateString('cs-CZ')}.`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Chyba při vystavení na web');
    } finally {
      setPublishing(false);
    }
  };

  const handleReturnToOriginalOwner = async () => {
    if (!animal || !activeIntakeId) return;

    setSavingReturnToOwner(true);
    try {
      // Close the intake with outcome "returned_to_owner"
      await ApiClient.closeIntake(activeIntakeId, {
        outcome: 'returned_to_owner',
        notes: returnToOwnerForm.notes || 'Návrat k původnímu majiteli během čekací lhůty',
      });

      // Refresh animal data (status should now be "returned_to_owner")
      const updated = await ApiClient.getAnimal(animal.id);
      setAnimal(updated);
      setActiveIntakeId(null);

      toast.success(`${animal.name} bylo úspěšně vráceno původnímu majiteli.`);
      setReturnToOwnerDialogOpen(false);
      setReturnToOwnerForm({ return_date: '', notes: '' });
    } catch (err: any) {
      toast.error(err?.message || 'Chyba při vracení zvířete');
    } finally {
      setSavingReturnToOwner(false);
    }
  };

  const handleSaveWebsiteDeadline = async () => {
    if (!animal) return;

    setSavingWebsiteDeadline(true);
    try {
      const updated = await ApiClient.updateAnimal(animal.id, {
        website_published_at: websiteDeadlineForm.published_at || null,
        website_deadline_at: websiteDeadlineForm.deadline_at || null,
      } as any);
      setAnimal(updated);
      toast.success('Data čekací lhůty aktualizována');
      setEditingWebsiteDeadline(false);
    } catch (err: any) {
      toast.error(err?.message || 'Chyba při ukládání');
    } finally {
      setSavingWebsiteDeadline(false);
    }
  };

  const startEditWebsiteDeadline = () => {
    if (animal) {
      setWebsiteDeadlineForm({
        published_at: animal.website_published_at || '',
        deadline_at: animal.website_deadline_at || '',
      });
    }
    setEditingWebsiteDeadline(true);
  };

  const startEditIntakeDate = () => {
    if (animal) {
      setIntakeDateInput(animal.intake_date ? animal.intake_date.split('T')[0] : (animal.current_intake_date ? animal.current_intake_date.split('T')[0] : ''));
    }
    setEditingIntakeDate(true);
  };

  // Derived
  const days = animal?.current_intake_date
    ? Math.floor((Date.now() - new Date(animal.current_intake_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const intakeDateFormatted = animal?.current_intake_date
    ? new Date(animal.current_intake_date).toLocaleDateString()
    : null;

  const latestWeight = weightLogs.length > 0 ? weightLogs[0] : null;
  const weightKg = latestWeight
    ? Number(latestWeight.weight_kg)
    : (animal?.weight_current_kg ?? animal?.weight_estimated_kg ?? null);

  // ── Loading Skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <Skeleton className="w-64 h-64 rounded-xl" />
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="w-12 h-4" />
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left space-y-3">
            <Skeleton className="h-8 w-48 mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-32 mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-40 mx-auto sm:mx-0" />
            <div className="flex gap-2 justify-center sm:justify-start">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="space-y-4">
            <Card>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
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
          <h1 className="text-3xl font-bold">{t('notFound.title')}</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">{t('notFound.description')}</p>
            <Link href="/dashboard/animals"><Button className="mt-4">{t('notFound.back')}</Button></Link>
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
          <div className="relative w-full max-w-xl aspect-square rounded-xl overflow-hidden bg-muted mx-auto group">
            <Image
              key={animal.id}
              src={getAnimalImageUrl(animal)}
              alt={animal.name}
              fill
              className="object-cover object-center"
              unoptimized
            />
            {!animal.primary_photo_url && (
              <span className="absolute bottom-1.5 inset-x-0 text-center text-[10px] text-white/60 pointer-events-none select-none">
                ilustrační foto
              </span>
            )}
            {/* Upload overlay */}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-white"
            >
              {uploadingPhoto ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
              <span className="text-xs font-medium">Nahrát foto</span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
          {/* Prev / Next arrows */}
          <div className="flex items-center gap-3">
            <Button
              variant="nav"
              size="icon"
              onClick={() => prevId && router.push(`/dashboard/animals/${prevId}`)}
              disabled={!prevId}
              aria-label="Předchozí zvíře"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentIdx >= 0 ? `${currentIdx + 1} / ${animalIds.length}` : ''}
            </span>
            <Button
              variant="nav"
              size="icon"
              onClick={() => nextId && router.push(`/dashboard/animals/${nextId}`)}
              disabled={!nextId}
              aria-label="Další zvíře"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          {/* Back link */}
          <Link href="/dashboard/animals">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> {t('backToList')}
            </Button>
          </Link>

          {/* Name + status inline */}
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start mb-1">
            <div className="flex-1 min-w-0">
              <EditableAnimalName animal={animal} onAnimalUpdate={handleAnimalUpdate} />
            </div>
            {/* Status badge — non-interactive; changes via action buttons */}
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(animal.status)}`}>
              {t(`status.${animal.status}`)}
            </span>
          </div>

          {/* Code + species */}
          <p className="text-muted-foreground mb-1">
            #{animal.public_code} · {animal.species}
            {animal.sex !== 'unknown' && ` · ${animal.sex === 'male' ? '♂' : '♀'}`}
            {(() => {
              const chip = animal.identifiers?.find(i => i.type === 'microchip');
              return chip ? (
                <span className="ml-2 inline-flex items-center gap-1 text-xs bg-muted border border-border rounded px-1.5 py-0.5">
                  🔖 {chip.value}
                </span>
              ) : null;
            })()}
          </p>

          {/* Days in shelter + kennel link — inline */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-3">
            {days !== null && (
              <span className="text-sm text-muted-foreground">
                <MapPin className="inline h-3.5 w-3.5 mr-0.5 mb-0.5" />
                {t('daysInShelterFull', { days, date: intakeDateFormatted ?? '' })}
              </span>
            )}
            {animal.current_kennel_id ? (
              <Link
                href={`/dashboard/kennels/${animal.current_kennel_id}`}
                className="text-sm text-primary font-medium hover:underline transition-colors flex items-center gap-0.5"
              >
                <MapPin className="inline h-3.5 w-3.5 mb-0.5" />
                {animal.current_kennel_name} ({animal.current_kennel_code})
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">{t('noKennel')}</span>
            )}
          </div>

          {/* Superadmin: Intake date edit */}
          {isSuperadmin && (
            <div className="flex items-center gap-2 mb-3 text-xs border-t pt-2 mt-2">
              {editingIntakeDate ? (
                <>
                  <Input
                    type="date"
                    value={intakeDateInput}
                    onChange={(e) => setIntakeDateInput(e.target.value)}
                    className="h-7 w-36 text-xs"
                  />
                  <Button size="sm" onClick={handleSaveIntakeDate} disabled={savingIntakeDate} className="h-7">
                    {savingIntakeDate ? '...' : '💾'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingIntakeDate(false)} className="h-7">
                    ✕
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Datum příjmu:</span>
                  <span className="font-mono">{intakeDateFormatted || '—'}</span>
                  <Button size="sm" variant="ghost" onClick={startEditIntakeDate} className="h-7 px-2">
                    ✏️
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Legal Deadline Section - for found animals */}
          {animal.current_intake_reason === 'found' && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-amber-800 dark:text-amber-200 text-sm">
                  ⚖️ Nálezové lhůty
                </h4>
                {isSuperadmin && !editingLegalDeadline && (
                  <Button size="sm" variant="ghost" onClick={startEditLegalDeadline} className="h-6 text-xs">
                    ✏️
                  </Button>
                )}
              </div>
              
              {editingLegalDeadline ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-24">Vyhlášení obcí:</label>
                    <Input
                      type="date"
                      value={legalDeadlineForm.notice_published_at}
                      onChange={(e) => setLegalDeadlineForm({ ...legalDeadlineForm, notice_published_at: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-24">Nálezce chce:</label>
                    <Select
                      value={legalDeadlineForm.finder_claims_ownership}
                      onValueChange={(v) => setLegalDeadlineForm({ ...legalDeadlineForm, finder_claims_ownership: v as '' | 'true' | 'false' })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">--</SelectItem>
                        <SelectItem value="true">Ano</SelectItem>
                        <SelectItem value="false">Ne</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-24">Obec převedla:</label>
                    <Select
                      value={legalDeadlineForm.municipality_irrevocably_transferred}
                      onValueChange={(v) => setLegalDeadlineForm({ ...legalDeadlineForm, municipality_irrevocably_transferred: v as '' | 'true' | 'false' })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="--" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">--</SelectItem>
                        <SelectItem value="true">Ano</SelectItem>
                        <SelectItem value="false">Ne</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={handleSaveLegalDeadline} disabled={savingLegalDeadline} className="h-7 text-xs">
                      {savingLegalDeadline ? '...' : '💾 Uložit'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingLegalDeadline(false)} className="h-7 text-xs">
                      ✕
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  {animal.legal_deadline_state === 'missing_data' ? (
                    <div className="text-red-600 dark:text-red-400">
                      ⚠️ {animal.legal_deadline_label || 'Chybí údaje pro výpočet lhůty'}
                    </div>
                  ) : animal.legal_deadline_state === 'expired' ? (
                    <div className="text-red-600 dark:text-red-400 font-semibold">
                      ❌ Lhůta vypršela
                      {animal.legal_deadline_label && <span className="font-normal ml-1">({animal.legal_deadline_label})</span>}
                    </div>
                  ) : animal.legal_deadline_days_left != null && animal.legal_deadline_days_left <= 14 ? (
                    <div className="text-orange-600 dark:text-orange-400 font-semibold">
                      ⏰ Zbývá {animal.legal_deadline_days_left} dní
                      {animal.legal_deadline_label && <span className="font-normal ml-1">({animal.legal_deadline_label})</span>}
                    </div>
                  ) : (
                    <div className="text-green-600 dark:text-green-400">
                      ✓ {animal.legal_deadline_label || 'Bez lhůty'}
                    </div>
                  )}
                  {animal.notice_published_at && (
                    <div className="text-xs text-muted-foreground">
                      Vyhlášeno: {new Date(animal.notice_published_at).toLocaleDateString('cs-CZ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 justify-center sm:justify-start flex-wrap">
            {animal.current_intake_date === null ? (
              /* No active intake — show only intake button */
              <Link href={`/dashboard/intake/new?animal_id=${animal.id}`}>
                <Button variant="default" size="sm">
                  <LogIn className="h-4 w-4 mr-2" />
                  {t('intake.registerIntake')}
                </Button>
              </Link>
            ) : (
              <>
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
              </>
            )}
            {animal.is_pregnant && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBirthDialogOpen(true)}
                className="border-pink-300 text-pink-700 hover:bg-pink-50 dark:border-pink-700 dark:text-pink-300"
              >
                <Baby className="h-4 w-4 mr-2" />
                {t('birth')}
              </Button>
            )}
            {/* Publish to Website (only for found animals in intake/quarantine) */}
            {activeIntakeReason === 'found' &&
             !animal.website_published_at &&
             ['intake', 'quarantine'].includes(animal.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePublishToWebsite()}
                disabled={publishing}
              >
                <Globe className="h-4 w-4 mr-2" />
                Vystaveno na webu
              </Button>
            )}
            {/* Special action for animals in waiting_adoption - Return to Original Owner */}
            {animal.status === 'waiting_adoption' && activeIntakeId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReturnToOwnerDialogOpen(true)}
                className="border-green-600 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Návrat k původnímu majiteli
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDocumentDialogOpen(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              {t('documents.createDocument')}
            </Button>
            {activeIntakeId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCloseIntakeOpen(true)}
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
              >
                {activeIntakeReason === 'hotel' ? t('intake.closeIntake') : t('intake.closeIntake')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('delete')}
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setQrDialogOpen(true)} className="h-8 w-8">
                    <QrCode className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>QR kód</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('tabs.timeline')}</TabsTrigger>
          <TabsTrigger value="feeding">{t('tabs.feeding')}</TabsTrigger>
          <TabsTrigger value="medical">{t('tabs.medical')}</TabsTrigger>
          <TabsTrigger value="passport">Očkovací průkaz</TabsTrigger>
          {(animal.species === 'dog' || animal.species === 'cat') && (
            <TabsTrigger value="personality">{t('tabs.personality')}</TabsTrigger>
          )}
          <TabsTrigger value="documents">{t('tabs.documents')}</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Basic Information - 2/3 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('overview.basicInfo')}</CardTitle>
              </CardHeader>
              <CardContent>
                <EditableAnimalDetails animal={animal} onAnimalUpdate={handleAnimalUpdate} />
              </CardContent>
            </Card>

            {/* Health & Welfare - 1/3 */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>{t('health.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
              {/* Active flags grid – only shown when true */}
              <div className="grid grid-cols-2 gap-2">
                {(animal.altered_status === 'neutered' || animal.altered_status === 'spayed') && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <Scissors className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-xs font-medium">{t('overview.neutered')}</span>
                  </div>
                )}
                {animal.is_dewormed && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <Pill className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-medium">{t('health.dewormed')}</span>
                  </div>
                )}
                {animal.is_aggressive && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="text-xs font-medium">{t('health.aggressive')}</span>
                  </div>
                )}
                {animal.is_pregnant && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800">
                    <Baby className="h-4 w-4 text-pink-600 shrink-0" />
                    <span className="text-xs font-medium">{t('health.pregnant')}</span>
                  </div>
                )}
                {animal.is_special_needs && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                    <Accessibility className="h-4 w-4 text-orange-600 shrink-0" />
                    <span className="text-xs font-medium">{t('overview.specialNeeds')}</span>
                  </div>
                )}
              </div>

              {/* Toggle buttons */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                {/* Neutered toggle – disabled with tooltip if already altered */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <button
                          className="text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={toggleAltered}
                          disabled={togglingAltered || animal.is_pregnant || animal.altered_status !== 'intact'}
                        >
                          {togglingAltered ? '...' : (animal.altered_status === 'neutered' || animal.altered_status === 'spayed' ? t('health.markIntact') : t('health.markAltered'))}
                        </button>
                      </span>
                    </TooltipTrigger>
                    {animal.is_pregnant && <TooltipContent>{t('overview.noNeuteringPregnant')}</TooltipContent>}
                    {!animal.is_pregnant && animal.altered_status !== 'intact' && <TooltipContent>{t('overview.alreadyAltered')}</TooltipContent>}
                  </Tooltip>
                </TooltipProvider>

                <button
                  className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${animal.is_dewormed ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-200' : 'border-input hover:bg-accent'}`}
                  onClick={toggleDewormed}
                  disabled={togglingDewormed}
                  title={t('health.toggleDewormed')}
                >
                  {togglingDewormed ? '...' : (animal.is_dewormed ? '✓ ' + t('health.dewormed') : t('health.dewormed') + '?')}
                </button>

                <button
                  className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${animal.is_aggressive ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200' : 'border-input hover:bg-accent'}`}
                  onClick={toggleAggressive}
                  disabled={togglingAggressive}
                  title={t('health.toggleAggressive')}
                >
                  {togglingAggressive ? '...' : (animal.is_aggressive ? '⚠ ' + t('health.aggressive') : t('health.aggressive') + '?')}
                </button>

                {animal.sex !== 'male' && (
                  <>
                    <button
                      className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${animal.is_pregnant ? 'bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900 dark:border-pink-700 dark:text-pink-200' : 'border-input hover:bg-accent'}`}
                      onClick={togglePregnant}
                      disabled={togglingPregnant}
                      title={t('health.togglePregnant')}
                    >
                      {togglingPregnant ? '...' : (animal.is_pregnant ? '✓ ' + t('health.pregnant') : t('health.pregnant') + '?')}
                    </button>
                    <button
                      className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${animal.is_lactating ? 'bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900 dark:border-pink-700 dark:text-pink-200' : 'border-input hover:bg-accent'}`}
                      onClick={toggleLactating}
                      disabled={togglingLactating}
                      title={t('health.toggleLactating')}
                    >
                      {togglingLactating ? '...' : (animal.is_lactating ? '✓ ' + t('health.lactating') : t('health.lactating') + '?')}
                    </button>
                  </>
                )}

                <button
                  className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${animal.is_critical ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200' : 'border-input hover:bg-accent'}`}
                  onClick={toggleCritical}
                  disabled={togglingCritical}
                  title={t('health.toggleCritical')}
                >
                  {togglingCritical ? '...' : (animal.is_critical ? '✓ ' + t('health.critical') : t('health.critical') + '?')}
                </button>

                <button
                  className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${animal.is_diabetic ? 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900 dark:border-orange-700 dark:text-orange-200' : 'border-input hover:bg-accent'}`}
                  onClick={toggleDiabetic}
                  disabled={togglingDiabetic}
                  title={t('health.toggleDiabetic')}
                >
                  {togglingDiabetic ? '...' : (animal.is_diabetic ? '✓ ' + t('health.diabetic') : t('health.diabetic') + '?')}
                </button>

                <button
                  className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${animal.is_cancer ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200' : 'border-input hover:bg-accent'}`}
                  onClick={toggleCancer}
                  disabled={togglingCancer}
                  title={t('health.toggleCancer')}
                >
                  {togglingCancer ? '...' : (animal.is_cancer ? '✓ ' + t('health.cancer') : t('health.cancer') + '?')}
                </button>

                <button
                  className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${animal.is_special_needs ? 'bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-900 dark:border-violet-700 dark:text-violet-200' : 'border-input hover:bg-accent'}`}
                  onClick={toggleSpecialNeeds}
                  disabled={togglingSpecialNeeds}
                  title={t('overview.toggleSpecialNeeds')}
                >
                  {togglingSpecialNeeds ? '...' : (animal.is_special_needs ? `✓ ${t('overview.specNeeds')}` : `${t('overview.specNeeds')}?`)}
                </button>
              </div>

              {/* Pregnancy extras */}
              {animal.is_pregnant && (
                <div className="space-y-2 border-t border-dashed border-pink-200 pt-2">
                  {animal.expected_litter_date && (
                    <p className="text-sm text-pink-700 dark:text-pink-300 font-medium">
                      {t('pregnancy.expectedLitter')}: {new Date(animal.expected_litter_date).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="date"
                      value={litterDateInput || (animal.expected_litter_date ?? '')}
                      onChange={e => setLitterDateInput(e.target.value)}
                      className="h-7 text-xs w-36"
                      title={t('pregnancy.litterDateTitle')}
                    />
                    <button
                      className="text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                      onClick={handleSaveLitterDate}
                      disabled={savingLitterDate || !litterDateInput}
                    >
                      {savingLitterDate ? t('pregnancy.savingLitterDate') : t('pregnancy.saveLitterDate')}
                    </button>
                    <button
                      className="text-xs px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                      onClick={handleRequestAbortion}
                      disabled={requestingAbortion}
                    >
                      {requestingAbortion ? t('pregnancy.processingAbortion') : `🚫 ${t('pregnancy.requestAbortion')}`}
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Weight */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                {t('health.weight')}
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
                  <p className="text-sm text-muted-foreground mt-1">
                    ⚡ {t('health.energyNeeds')}: ~{calcMER(
                      Number(latestWeight.weight_kg),
                      animal.age_group,
                      animal.altered_status,
                      animal.is_pregnant,
                      animal.is_lactating,
                      animal.is_critical,
                      animal.is_diabetic,
                      animal.is_cancer,
                      animal.species,
                    )} kcal/den
                  </p>
                  <details className="text-xs text-muted-foreground mt-1 ml-2">
                    <summary className="cursor-pointer hover:text-foreground">{t('weight.showCalc')}</summary>
                    <div className="mt-1 space-y-0.5 font-mono">
                      <p>RER = 70 × {Number(latestWeight.weight_kg).toFixed(1)}^0.75 = {calcRER(Number(latestWeight.weight_kg))} kcal</p>
                      <p>Faktor = {getMERFactor(animal.age_group, animal.altered_status, animal.is_pregnant, animal.is_lactating, animal.is_critical, animal.is_diabetic, animal.is_cancer, animal.species)} ({getMERFactorLabel(animal.age_group, animal.altered_status, animal.is_pregnant, animal.is_lactating, animal.is_critical, animal.is_diabetic, animal.is_cancer, animal.species)})</p>
                      <p>MER = {calcRER(Number(latestWeight.weight_kg))} × {getMERFactor(animal.age_group, animal.altered_status, animal.is_pregnant, animal.is_lactating, animal.is_critical, animal.is_diabetic, animal.is_cancer, animal.species)} = {calcMER(Number(latestWeight.weight_kg), animal.age_group, animal.altered_status, animal.is_pregnant, animal.is_lactating, animal.is_critical, animal.is_diabetic, animal.is_cancer, animal.species)} kcal/den</p>
                    </div>
                  </details>
                </div>
              ) : weightKg ? (
                <div>
                  <p className="text-2xl font-bold">{Number(weightKg).toFixed(1)} kg</p>
                  <p className="text-xs text-muted-foreground">{t('weight.estimated')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ⚡ {t('health.energyNeeds')}: ~{calcMER(
                      Number(weightKg),
                      animal.age_group,
                      animal.altered_status,
                      animal.is_pregnant,
                      animal.is_lactating,
                      animal.is_critical,
                      animal.is_diabetic,
                      animal.is_cancer,
                      animal.species,
                    )} kcal/den
                  </p>
                  <details className="text-xs text-muted-foreground mt-1 ml-2">
                    <summary className="cursor-pointer hover:text-foreground">{t('weight.showCalc')}</summary>
                    <div className="mt-1 space-y-0.5 font-mono">
                      <p>RER = 70 × {Number(weightKg).toFixed(1)}^0.75 = {calcRER(Number(weightKg))} kcal</p>
                      <p>Faktor = {getMERFactor(animal.age_group, animal.altered_status, animal.is_pregnant, animal.is_lactating, animal.is_critical, animal.is_diabetic, animal.is_cancer, animal.species)} ({getMERFactorLabel(animal.age_group, animal.altered_status, animal.is_pregnant, animal.is_lactating, animal.is_critical, animal.is_diabetic, animal.is_cancer, animal.species)})</p>
                      <p>MER = {calcRER(Number(weightKg))} × {getMERFactor(animal.age_group, animal.altered_status, animal.is_pregnant, animal.is_lactating, animal.is_critical, animal.is_diabetic, animal.is_cancer, animal.species)} = {calcMER(Number(weightKg), animal.age_group, animal.altered_status, animal.is_pregnant, animal.is_lactating, animal.is_critical, animal.is_diabetic, animal.is_cancer, animal.species)} kcal/den</p>
                    </div>
                  </details>
                </div>
              ) : null}

              {/* No measurements yet */}
              {weightLogs.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('health.weightFirstMeasurement')}</p>
              )}

              {/* Add measurement form */}
              <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
                <p className="text-xs font-medium text-muted-foreground">{t('health.addWeight')}</p>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="999"
                    placeholder={t('health.weightKg')}
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                  <Input
                    type="date"
                    value={weightDate}
                    onChange={e => setWeightDate(e.target.value)}
                    className="w-36 h-8 text-sm"
                    title={t('health.weightDate')}
                  />
                  <Input
                    type="text"
                    placeholder={t('health.weightNotes')}
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
                    {savingWeight ? t('health.weightSaving') : t('health.weightSave')}
                  </Button>
                  {weightInput && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setWeightInput(''); setWeightDate(''); setWeightNotes(''); }}
                      title="Zrušit"
                    >
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
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
              <CardTitle>{t('feeding.tabTitle')}</CardTitle>
              <CardDescription>{t('feeding.tabDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <MERCalculator
                animalId={animalId}
                weightKg={latestWeight ? Number(latestWeight.weight_kg) : null}
                alteredStatus={animal.altered_status}
              />
            </CardContent>
          </Card>
          
          {/* Current MER from DB */}
          {animal.mer_kcal_per_day && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-800">Denní energetická potřeba</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-700">
                  {animal.mer_kcal_per_day} <span className="text-lg font-normal">kcal/den</span>
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Vypočteno z váhy {animal.weight_current_kg} kg
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Timeline ── */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>{t('timeline.title')}</CardTitle>
              <CardDescription>{t('timeline.description')}</CardDescription>
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
                        {ev.date.toLocaleDateString()}
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
                        {t('timeline.expectedLitter')}
                        {new Date(animal.expected_litter_date) > new Date() && ` ${t('pregnancy.future')}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(animal.expected_litter_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {animal.current_intake_date && (
                  <div className="relative mb-6">
                    <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
                    <div className="pl-2">
                      <p className="text-sm font-semibold">{t('timeline.intake')}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(animal.current_intake_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Kennel assignment history */}
                {loadingKennelHistory ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : kennelHistory.map((entry, i) => (
                  <div key={i} className="relative mb-6">
                    <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-purple-400 border-2 border-background" />
                    <div className="pl-2">
                      <p className="text-sm font-semibold flex items-center gap-1">
                        <Home className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                        {t('timeline.movedToKennel', { code: entry.kennel_code })}
                        {!entry.released_at && <span className="text-xs text-purple-600 dark:text-purple-400 ml-1">{t('timeline.currentKennel')}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.assigned_at).toLocaleDateString()}
                        {entry.released_at && ` – ${new Date(entry.released_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="relative mb-6">
                  <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-background" />
                  <div className="pl-2">
                    <p className="text-sm font-semibold">{t('timeline.created')}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(animal.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  {/* TODO: M4 - load full event history from API */}
                  {t('timeline.comingSoon')}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

{/* ── Medical ── */}
        <TabsContent value="medical" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setMedicalDialogOpen(true)}>
              <Stethoscope className="h-4 w-4 mr-2" />
              {t('medical.requestProcedure')}
            </Button>
          </div>
          {/* Weight history sparkline */}
          {loadingWeight ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('health.weightHistory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ) : weightLogs.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('health.weightHistory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <WeightSparkline logs={weightLogs} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{new Date(weightLogs[weightLogs.length - 1].measured_at).toLocaleDateString()}</span>
                  <span>{new Date(weightLogs[0].measured_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Vaccinations */}
          <Card>
            <CardHeader>
              <CardTitle>Očkování</CardTitle>
              <CardDescription>Historie očkování zvířete</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingVaccinations ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : vaccinations.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Žádná očkování</p>
              ) : (
                <div className="space-y-2">
                  {vaccinations.map((vac: any) => (
                    <div key={vac.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <Stethoscope className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {vac.vaccination_type === 'rabies' && 'Vzteklina'}
                            {vac.vaccination_type === 'distemper' && 'Psinka'}
                            {vac.vaccination_type === 'parvovirus' && 'Parvoviróza'}
                            {vac.vaccination_type === 'hepatitis' && 'Infekční hepatitida'}
                            {vac.vaccination_type === 'leptospirosis' && 'Leptospiróza'}
                            {vac.vaccination_type === 'bordetella' && 'Bordetella'}
                            {vac.vaccination_type === 'feline_vaccine' && 'Kočičí očkování'}
                            {vac.vaccination_type === 'other' && 'Jiné očkování'}
                            {!['rabies','distemper','parvovirus','hepatitis','leptospirosis','bordetella','feline_vaccine','other'].includes(vac.vaccination_type) && vac.vaccination_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(vac.administered_at).toLocaleDateString('cs-CZ')}
                          </p>
                        </div>
                      </div>
                      {vac.lot_number && (
                        <Badge variant="outline">
                          Š: {vac.lot_number}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Passport ── */}
        <TabsContent value="passport">
          <PassportTab animalId={animal.id} />
        </TabsContent>

{/* ── Personality + Behavior ── */}
        <TabsContent value="personality">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Behavior notes */}
            <Card>
              <CardHeader>
                <CardTitle>{t('behavior.title')}</CardTitle>
                <CardDescription>{t('behavior.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  placeholder={t('behavior.placeholder')}
                  value={behaviorNotes}
                  onChange={e => setBehaviorNotes(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSaveBehaviorNotes}
                    disabled={savingBehaviorNotes}
                  >
                    {savingBehaviorNotes ? t('behavior.saving') : t('behavior.save')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right: Personality axes */}
            {(animal.species === 'dog' || animal.species === 'cat') && (
              <PersonalityTab species={animal.species} />
            )}
          </div>
        </TabsContent>

{/* ── Documents ── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('documents.title')}</CardTitle>
                  <CardDescription>{t('documents.description')}</CardDescription>
                </div>
                <div>
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleDocumentUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => documentInputRef.current?.click()}
                    disabled={uploadingDocument}
                  >
                    {uploadingDocument ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Nahrát dokument
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDocuments ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Žádné dokumenty</p>
                  <p className="text-sm mt-1">Nahrajte první dokument pomocí tlačítka výše</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-4 flex flex-col gap-2">
                      <div className="flex items-start gap-3">
                        {doc.mime_type?.startsWith('image/') ? (
                          <div className="w-16 h-16 rounded bg-muted overflow-hidden shrink-0">
                            <img src={doc.thumbnail_url || doc.file_url} alt={doc.original_filename} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" title={doc.original_filename}>
                            {doc.original_filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {doc.uploaded_by_user_name && <span>Nahrál: {doc.uploaded_by_user_name}</span>}
                        {doc.uploaded_by_user_name && doc.created_at && <span> · </span>}
                        {doc.created_at && <span>{new Date(doc.created_at).toLocaleDateString('cs-CZ')}</span>}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Otevřít
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteDocument(doc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Action zone – de-emphasized, at the bottom ── */}
      {!['deceased', 'adopted', 'euthanized'].includes(animal.status) && (
        <div className="pt-8 border-t border-dashed flex flex-wrap gap-3 items-center">

          {/* Mark as available — for intake animals */}
          {animal.status === 'intake' && (
            <div className="relative inline-block">
              <button
                className="text-xs text-muted-foreground/50 hover:text-green-600 transition-colors px-3 py-1.5 rounded border border-dashed border-muted-foreground/20 hover:border-green-400"
                onClick={async () => {
                  if (!confirm(`Označit ${animal.name} jako dostupné k adopci?`)) return;
                  try {
                    const updated = await ApiClient.updateAnimal(animal.id, { status: 'available' } as any);
                    setAnimal(updated);
                    toast.success(t('overview.statusChanged', { status: t('status.available') }));
                  } catch { toast.error(t('overview.statusChangeError')); }
                }}
              >
                <CheckCheck className="inline h-3 w-3 mr-1" />
                {t('markAvailable')}
              </button>
            </div>
          )}

          {/* Escape — only for non-terminal, non-escaped animals */}
          {!['escaped', 'transferred', 'returned_to_owner'].includes(animal.status) && (
            <div className="relative inline-block">
              <button
                className="text-xs text-muted-foreground/50 hover:text-orange-500 transition-colors px-3 py-1.5 rounded border border-dashed border-muted-foreground/20 hover:border-orange-300"
                onClick={() => setEscapeOpen(true)}
              >
                <PersonStanding className="inline h-3 w-3 mr-1" />
                {t('escape.button')}
              </button>
            </div>
          )}

          {/* Found after escape */}
          {animal.status === 'escaped' && (
            <div className="relative inline-block">
              <button
                className="text-xs text-muted-foreground/50 hover:text-blue-600 transition-colors px-3 py-1.5 rounded border border-dashed border-muted-foreground/20 hover:border-blue-300"
                onClick={() => setFoundOpen(true)}
              >
                <LogIn className="inline h-3 w-3 mr-1" />
                {t('escape.foundButton')}
              </button>
            </div>
          )}

          {/* Record death */}
          <div className="relative inline-block">
            <button
              className="text-xs text-muted-foreground/50 hover:text-red-500 transition-colors px-3 py-1.5 rounded border border-dashed border-muted-foreground/20 hover:border-red-300"
              onClick={async () => {
                if (!confirm(t('confirmDeath', { name: animal.name }))) return;
                try {
                  const updated = await ApiClient.updateAnimal(animal.id, { status: 'deceased' } as any);
                  setAnimal(updated);
                  setHealthEvents(prev => [{ text: t('healthEvents.deathRecorded'), date: new Date() }, ...prev]);
                  toast.success(t('deathRecorded'));
                  setTimeout(() => toast.info(t('deathTaskCreated')), 800);
                } catch { toast.error(t('deathError')); }
              }}
            >
              {t('recordDeath')}
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
          species={animal.species as 'dog' | 'cat'}
          open={birthDialogOpen}
          onOpenChange={setBirthDialogOpen}
          onBirthRegistered={(count) => {
            setAnimal(prev => prev ? { ...prev, is_pregnant: false, expected_litter_date: null } : null);
            setHealthEvents(prev => [
              { text: t('healthEvents.birthRegistered', { count }), date: new Date() },
              ...prev,
            ]);
          }}
        />
      )}

      {/* Create Document Dialog */}
      {animal && (
        <CreateDocumentDialog
          animalId={animal.id}
          animalName={animal.name}
          open={documentDialogOpen}
          onOpenChange={setDocumentDialogOpen}
          onDocumentCreated={() => {
            // Refresh documents list if needed
            toast.success(t('documents.documentCreated'));
          }}
        />
      )}

      {/* Close Intake Dialog */}
      <Dialog open={closeIntakeOpen} onOpenChange={(open) => {
        setCloseIntakeOpen(open);
        if (!open) {
          // Reset outcome to default based on intake type when closing
          setCloseIntakeOutcome(activeIntakeReason === 'hotel' ? 'hotel_end' : 'adopted');
          setCloseIntakeNotes('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('intake.closeIntake')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('intake.outcome')}</label>
              <Select value={closeIntakeOutcome} onValueChange={(v) => setCloseIntakeOutcome(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeIntakeReason === 'hotel' ? (
                    <SelectItem value="hotel_end">{t('intake.outcomes.hotel_end')}</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="adopted">{t('intake.outcomes.adopted')}</SelectItem>
                      <SelectItem value="deceased">{t('intake.outcomes.deceased')}</SelectItem>
                      <SelectItem value="lost">{t('intake.outcomes.lost')}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('intake.notesOptional')}</label>
              <Textarea
                value={closeIntakeNotes}
                onChange={e => setCloseIntakeNotes(e.target.value)}
                placeholder={t('intake.notesPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseIntakeOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleCloseIntake} disabled={closingIntake}>
              {closingIntake ? t('saving') : t('intake.closeIntake')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Found after escape Dialog */}
      <Dialog open={foundOpen} onOpenChange={setFoundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-blue-500" />
              {t('escape.foundTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t('escape.foundDescription')}</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('escape.foundDate')}</label>
              <Input
                type="date"
                value={foundDate}
                onChange={e => setFoundDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('escape.notesOptional')}</label>
              <Textarea
                value={foundNotes}
                onChange={e => setFoundNotes(e.target.value)}
                placeholder={t('escape.notesPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFoundOpen(false)}>{t('cancel')}</Button>
            <Button
              onClick={handleFound}
              disabled={recordingFound}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {recordingFound ? t('saving') : t('escape.foundConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escape Incident Dialog */}
      <Dialog open={escapeOpen} onOpenChange={setEscapeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PersonStanding className="h-5 w-5 text-orange-500" />
              {t('escape.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t('escape.description')}</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('escape.date')}</label>
              <Input
                type="date"
                value={escapeDate}
                onChange={e => setEscapeDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('escape.notesOptional')}</label>
              <Textarea
                value={escapeNotes}
                onChange={e => setEscapeNotes(e.target.value)}
                placeholder={t('escape.notesPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscapeOpen(false)}>{t('cancel')}</Button>
            <Button
              variant="destructive"
              onClick={handleEscape}
              disabled={recordingEscape}
            >
              <PersonStanding className="h-4 w-4 mr-2" />
              {recordingEscape ? t('saving') : t('escape.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR kód pro zvíře</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {animal && (
              <>
                <div className="bg-white p-4 rounded-lg border">
                  <QRCode
                    value={`https://sqlpet.vercel.app/cs/public/${selectedOrg?.slug || 'animals'}/${animal.id}`}
                    size={200}
                    level="M"
                  />
                </div>
                <div className="text-center">
                  <p className="font-mono font-bold text-lg">{animal.public_code}</p>
                  <p className="text-muted-foreground">{animal.name}</p>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Naskenujte QR kód pro rychlý přístup k záznamu o zvířeti v systému.
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
                    link.download = `animal-${animal.public_code}-qr.svg`;
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

      {/* Return to Original Owner Dialog */}
      <Dialog open={returnToOwnerDialogOpen} onOpenChange={setReturnToOwnerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Návrat k původnímu majiteli</DialogTitle>
            <DialogDescription>
              {animal?.name} bude vráceno původnímu majiteli. Intake bude ukončen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Toto zvíře je ve čekací lhůtě. Ukončení intake jako &apos;návrat k majiteli&apos; je během této lhůty povoleno.
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Poznámky (volitelné)</label>
              <Textarea
                value={returnToOwnerForm.notes}
                onChange={(e) => setReturnToOwnerForm({ ...returnToOwnerForm, notes: e.target.value })}
                placeholder="Např. jak majitel prokázal vlastnictví..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnToOwnerDialogOpen(false)}>
              Zrušit
            </Button>
            <Button onClick={handleReturnToOriginalOwner} className="bg-green-600 hover:bg-green-700" disabled={savingReturnToOwner}>
              {savingReturnToOwner ? 'Ukládání...' : 'Potvrdit návrat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
