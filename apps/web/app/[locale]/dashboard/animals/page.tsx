'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Search, Loader2, LayoutGrid, List, ArrowRight, Scissors, Pill, AlertTriangle, Baby, Accessibility, CheckSquare, Square, ClipboardList, Dog, Download, Zap, Syringe, Milk, Heart, QrCode } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ApiClient, { Animal, AnimalIdentifier } from '@/app/lib/api';
import { getAnimalImageUrl } from '@/app/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { cn } from '@/lib/utils';
import { userHasPermission } from '@/app/lib/permissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CollarRibbon } from '@/app/components/animals/CollarRibbon';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'reserved':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    case 'adopted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'fostered':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'transferred':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'deceased':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    case 'escaped':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'quarantine':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', rodent: '🐹', bird: '🐦', other: '🐾',
};

const AGE_LABELS: Record<string, string> = {
  baby: 'Mládě',
  young: 'Mladé',
  adult: 'Dospělé',
  senior: 'Senior',
};

function formatBreedName(b: { display_name?: string; breed_name?: string }): string {
  if (b.display_name) return b.display_name;
  if (!b.breed_name) return '—';
  // Prettify slug: "akita-inu" → "Akita Inu"
  return b.breed_name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AnimalsPage() {
  const router = useRouter();
  const t = useTranslations();
  const tSpecies = useTranslations('animals.species');
  const { user, permissions, selectedOrg } = useAuth();
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'available' | 'all'>('active');
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'urgent' | 'expired' | 'missing'>('all');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'table'>('grid');

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTaskOpen, setBulkTaskOpen] = useState(false);
  const [bulkTaskForm, setBulkTaskForm] = useState({ title: '', task_type: 'medical', priority: 'high', due_at: '', notes: '' });
  const [creatingBulkTask, setCreatingBulkTask] = useState(false);
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
  const [walkingAnimals, setWalkingAnimals] = useState<Set<string>>(new Set());

  // Export permission check
  const canExport = user?.is_superadmin || selectedOrg?.role === 'admin';

  // Export all animals to CSV
  const handleExportCSV = () => {
    if (animals.length === 0) return;

    const headers = [
      'id', 'public_code', 'name', 'species', 'sex', 'status', 'color',
      'altered_status', 'age_group', 'birth_date_estimated',
      'current_kennel_name', 'current_kennel_code', 'current_intake_date',
      'is_dewormed', 'is_aggressive', 'is_pregnant', 'is_special_needs',
      'behavior_notes', 'weight_current_kg', 'weight_estimated_kg', 'bcs',
      'expected_litter_date', 'last_walked_at', 'created_at', 'updated_at',
      'breeds', 'tags', 'identifiers',
    ];

    const rows = animals.map(animal => {
      const row: Record<string, any> = {};
      for (const header of headers) {
        const value = (animal as any)[header];
        if (value === null || value === undefined) {
          row[header] = '';
        } else if (Array.isArray(value)) {
          row[header] = value.map((item: any) => 
            typeof item === 'object' 
              ? item.name || item.breed_name || item.display_name || JSON.stringify(item)
              : item
          ).join('; ');
        } else if (typeof value === 'boolean') {
          row[header] = value ? '1' : '0';
        } else {
          row[header] = String(value);
        }
      }
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => {
        const val = row[h] || '';
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `animals_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Export dokončen');
  };

  // Fetch animals from API
  useEffect(() => {
    const fetchAnimals = async () => {
      try {
        setLoading(true);
        const data = await ApiClient.getAnimals();
        console.log('[ANIMALS_LIST] Raw API response:', data);
        console.log('[ANIMALS_LIST] First item:', data.items[0]);
        setAnimals(data.items);
      } catch (error) {
        toast.error('Failed to load animals');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnimals();
  }, []);

  const availableSpecies = useMemo(
    () => [...new Set(animals.map((a) => a.species))].sort(),
    [animals]
  );

  const INACTIVE_STATUSES = ['deceased', 'adopted', 'transferred', 'returned_to_owner', 'euthanized'];

  const filtered = animals.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesSpecies = !speciesFilter || a.species === speciesFilter;
    const matchesStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'available' ? a.status === 'available' :
      /* active */ !INACTIVE_STATUSES.includes(a.status);
    
    // Legal deadline filter - only for found animals
    const isFoundAnimal = a.current_intake_reason === 'found';
    let matchesDeadline = true;
    if (deadlineFilter !== 'all') {
      if (!isFoundAnimal) {
        matchesDeadline = false;
      } else if (deadlineFilter === 'urgent') {
        // 14 days or less
        matchesDeadline = a.legal_deadline_state === 'running' && a.legal_deadline_days_left !== null && a.legal_deadline_days_left !== undefined && a.legal_deadline_days_left <= 14;
      } else if (deadlineFilter === 'expired') {
        matchesDeadline = a.legal_deadline_state === 'expired';
      } else if (deadlineFilter === 'missing') {
        matchesDeadline = a.legal_deadline_state === 'missing_data';
      }
    }
    
    return matchesSearch && matchesSpecies && matchesStatus && matchesDeadline;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkCreateTask = async () => {
    if (!bulkTaskForm.title || selectedIds.size === 0) return;
    setCreatingBulkTask(true);
    try {
      const body: Record<string, any> = {
        animal_ids: Array.from(selectedIds),
        title: bulkTaskForm.title,
        task_type: bulkTaskForm.task_type,
        priority: bulkTaskForm.priority,
        notes: bulkTaskForm.notes || undefined,
        due_at: bulkTaskForm.due_at ? new Date(bulkTaskForm.due_at).toISOString() : undefined,
      };
      await ApiClient.post('/tasks/bulk', body);
      setBulkTaskOpen(false);
      setSelectMode(false);
      setSelectedIds(new Set());
      setBulkTaskForm({ title: '', task_type: 'medical', priority: 'high', due_at: '', notes: '' });
      toast.success(`Úkoly vytvořeny pro ${body.animal_ids.length} zvířat`);
    } catch (err: any) {
      toast.error('Nepodařilo se vytvořit úkoly: ' + (err.message || ''));
    } finally {
      setCreatingBulkTask(false);
    }
  };

  const handleMarkAsWalked = async (animalId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWalkingAnimals(prev => new Set(prev).add(animalId));
    try {
      const updated = await ApiClient.markAnimalWalked(animalId);
      setAnimals(prev => prev.map(a => a.id === animalId ? updated : a));
      toast.success(t('animals.walked'));
    } catch (err: any) {
      toast.error('Nepodařilo se označit jako venčené');
    } finally {
      setWalkingAnimals(prev => {
        const next = new Set(prev);
        next.delete(animalId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('nav.animals')}
          </h1>
          <p className="text-muted-foreground mt-1 hidden md:block">
            Manage shelter animals
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={selectMode ? 'default' : 'outline'}
            onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
          >
            {selectMode ? (
              <><CheckSquare className="h-4 w-4 mr-2" />Výběr zapnutý</>
            ) : (
              <><Square className="h-4 w-4 mr-2" />Vybrat</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setView(v => v === 'grid' ? 'table' : 'grid')}
          >
            {view === 'grid' ? (
              <><List className="h-4 w-4 mr-2" />{t('animals.view.table')}</>
            ) : (
              <><LayoutGrid className="h-4 w-4 mr-2" />{t('animals.view.grid')}</>
            )}
          </Button>
          <div className="hidden md:inline-flex">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/dashboard/animals/qr-sheet">
                    <Button variant="outline" size="icon">
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>QR sheet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button className="gap-2" onClick={() => setCreateChoiceOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('animals.createChoice.withIntake')}
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-2 md:space-y-0">
        <div className="flex gap-2 items-center md:flex-nowrap flex-wrap">
          <h2 className="text-sm font-medium text-muted-foreground whitespace-nowrap hidden md:inline">Search & Filter</h2>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hledat zvíře..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          <Button
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-2.5"
            onClick={() => setStatusFilter('active')}
          >
            {t('animals.statusFilter.active')}
          </Button>
          <Button
            variant={statusFilter === 'available' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-2.5"
            onClick={() => setStatusFilter('available')}
          >
            {t('animals.statusFilter.available')}
          </Button>
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-2.5"
            onClick={() => setStatusFilter('all')}
          >
            {t('animals.statusFilter.all')}
          </Button>
        </div>

        {/* Mobile: deadline filters on second row */}
        <div className="flex gap-2 items-center md:hidden flex-wrap">
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            variant={deadlineFilter === 'urgent' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-2.5 text-orange-600"
            onClick={() => setDeadlineFilter(deadlineFilter === 'urgent' ? 'all' : 'urgent')}
          >
            ⏰ Lhůta do 14d
          </Button>
          <Button
            variant={deadlineFilter === 'expired' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-2.5 text-red-600"
            onClick={() => setDeadlineFilter(deadlineFilter === 'expired' ? 'all' : 'expired')}
          >
            ❌ Vypršelo
          </Button>
        </div>

        {/* Mobile: species filters on third row */}
        <div className="flex gap-2 items-center md:hidden flex-wrap">
          {availableSpecies.length > 1 && availableSpecies.map((sp) => (
            <Button
              key={sp}
              variant={speciesFilter === sp ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => setSpeciesFilter(speciesFilter === sp ? null : sp)}
            >
              {tSpecies(sp)}
            </Button>
          ))}
        </div>

        {/* Desktop: all filters on one row */}
        <div className="hidden md:flex gap-2 items-center">
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            variant={deadlineFilter === 'urgent' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-2.5 text-orange-600"
            onClick={() => setDeadlineFilter(deadlineFilter === 'urgent' ? 'all' : 'urgent')}
          >
            ⏰ Lhůta do 14d
          </Button>
          <Button
            variant={deadlineFilter === 'expired' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-2.5 text-red-600"
            onClick={() => setDeadlineFilter(deadlineFilter === 'expired' ? 'all' : 'expired')}
          >
            ❌ Vypršelo
          </Button>
          {availableSpecies.length > 1 && availableSpecies.map((sp) => (
            <Button
              key={sp}
              variant={speciesFilter === sp ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => setSpeciesFilter(speciesFilter === sp ? null : sp)}
            >
              {tSpecies(sp)}
            </Button>
          ))}
        </div>
      </div>

      {/* Animals Grid / Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {filtered.map((animal) => (
            selectMode ? (
              <div
                key={animal.id}
                onClick={() => toggleSelect(animal.id)}
                className={`cursor-pointer rounded-lg border overflow-hidden transition-colors ${selectedIds.has(animal.id) ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
              >
                <Card className="border-0 rounded-none">
                  <div className="relative w-full aspect-square bg-muted overflow-hidden">
                    <Image src={getAnimalImageUrl(animal)} alt={animal.name} fill className="object-cover object-center" unoptimized />
                    {selectedIds.has(animal.id) && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <CheckSquare className="h-8 w-8 text-primary drop-shadow" />
                      </div>
                    )}
                    {animal.current_kennel_code && (
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono font-semibold">
                        {animal.current_kennel_code}
                      </div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <p className="font-bold text-sm leading-tight truncate">{animal.name}</p>
                  </div>
                </Card>
              </div>
            ) : (
            <Link key={animal.id} href={`/dashboard/animals/${animal.id}`} onClick={(e) => { console.log('[ANIMALS_LIST] Link clicked, animal:', animal); e.preventDefault(); router.push(`/dashboard/animals/${animal.id}`) }}>
              <Card className="hover:bg-accent transition-colors cursor-pointer overflow-hidden">
                {/* Square thumbnail — equal padding on all sides */}
                <div className={cn(
                  "relative w-full aspect-square bg-muted overflow-hidden",
                  animal.sex === 'male' && "outline outline-1 outline-blue-600 md:outline-0",
                  animal.sex === 'female' && "outline outline-1 outline-pink-600 md:outline-0"
                )}>
                  <Image
                    src={getAnimalImageUrl(animal)}
                    alt={animal.name}
                    fill
                    className="object-cover object-center"
                    unoptimized
                  />
                    {/* Collar ribbon (litter identification) */}
                    {animal.collar_color && <CollarRibbon color={animal.collar_color} size="sm" />}

                    {/* Top badges row */}
                  <div className="absolute top-1 left-1 right-1 flex items-start justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {animal.is_special_needs && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-600 text-white text-xs" title="Speciální potřeby">
                          ⭐
                        </span>
                      )}
                      {animal.is_critical && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs" title="Kritický stav">
                          !
                        </span>
                      )}
                      {animal.is_diabetic && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs" title="Cukrovka">
                        💉
                      </span>
                      )}
                      {/* Legal deadline badge - only for found animals */}
                      {animal.current_intake_reason === 'found' && animal.legal_deadline_state && animal.legal_deadline_state !== 'running' && (
                        <span 
                          className={cn(
                            "inline-flex items-center justify-center px-1.5 h-5 rounded text-xs font-semibold",
                            animal.legal_deadline_state === 'expired' && "bg-red-600 text-white",
                            animal.legal_deadline_state === 'missing_data' && "bg-yellow-500 text-white",
                            animal.legal_deadline_state === 'running' && animal.legal_deadline_days_left !== null && animal.legal_deadline_days_left !== undefined && animal.legal_deadline_days_left <= 14 && "bg-orange-500 text-white"
                          )}
                          title={animal.legal_deadline_label || ''}
                        >
                          {animal.legal_deadline_state === 'expired' ? '❌' : 
                           animal.legal_deadline_state === 'missing_data' ? '⚠️' :
                           animal.legal_deadline_days_left !== null ? `${animal.legal_deadline_days_left}d` : '?'}
                        </span>
                      )}
                    </div>
                    {/* Age + Sex in ONE circle - desktop only */}
                    <div className={cn(
                      "hidden md:flex absolute top-1 right-1 w-8 h-8 rounded-full items-center justify-center text-xs font-bold",
                      animal.sex === 'male' ? "bg-blue-600 text-white" : 
                      animal.sex === 'female' ? "bg-pink-600 text-white" : 
                      "bg-gray-500 text-white"
                    )}>
                      {animal.estimated_age_years != null 
                        ? `${animal.estimated_age_years}` 
                        : animal.age_group === 'baby' ? 'B' :
                          animal.age_group === 'young' ? 'Y' :
                          animal.age_group === 'adult' ? 'A' :
                          animal.age_group === 'senior' ? 'S' : '?'}
                    </div>
                  </div>
                  {/* Mobile: just name without sex icon */}
                  <div className="md:hidden absolute bottom-1 left-1 right-1 flex items-end">
                    <span className="font-bold text-white text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate">{animal.name}</span>
                  </div>
                  {/* Desktop: name + sex icon */}
                  <div className="hidden md:flex absolute bottom-1 left-1 right-1 items-end justify-between">
                    <span className="font-bold text-white text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate max-w-[100px]">{animal.name}</span>
                    <div className={cn(
                      "text-[10px] font-bold",
                      animal.sex === 'male' ? "text-blue-600" : 
                      animal.sex === 'female' ? "text-pink-600" : 
                      "text-gray-400"
                    )}>
                      {animal.sex === 'male' ? '♂' : animal.sex === 'female' ? '♀' : ''}
                    </div>
                  </div>
                </div>
                {/* Card footer */}
                <div className="p-2 space-y-1">
                  {/* Health badges row */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {animal.is_critical && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700" title="Kritický stav">
                          !
                        </span>
                      )}
                      {animal.is_diabetic && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700" title="Cukrovka">
                          💉
                        </span>
                      )}
                      {animal.is_pregnant && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-100 text-pink-700" title="Březí">
                          ♀+
                        </span>
                      )}
                      {animal.is_lactating && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-100 text-pink-700" title="Kojící">
                          ♀~
                        </span>
                      )}
                      {animal.is_cancer && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700" title="Nádor">
                          ☗
                        </span>
                      )}
                      {animal.is_aggressive && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700" title="Agresivní">
                          ⚠
                        </span>
                      )}
                      {(animal.altered_status === 'neutered' || animal.altered_status === 'spayed') && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700" title="Vykastrované">
                          ✂
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">#{animal.public_code}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {animal.current_kennel_code && (
                      <span className="text-xs font-mono font-semibold">{animal.current_kennel_code}</span>
                    )}
                    <Badge className={cn("text-[10px] px-1.5 py-0", getStatusColor(animal.status))}>
                      {t(`animals.status.${animal.status}`)}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
            )
          ))}
        </div>
      ) : (
        /* Table view */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {selectMode && <th className="w-10 px-3 py-3"></th>}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-12"></th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('animals.name')}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('animals.species.label')}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('animals.breed')}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('animals.age')}</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground w-28" title={t('animals.health.title')}>{t('animals.health.title')}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('animals.status.label')}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('animals.kennel')}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('animals.intakeDate')}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((animal) => (
                  <tr
                    key={animal.id}
                    className={`border-b hover:bg-muted/50 transition-colors cursor-pointer ${selectMode && selectedIds.has(animal.id) ? 'bg-primary/5' : ''}`}
                    onClick={() => { console.log('[ANIMALS_LIST] Clicked animal:', animal.id, animal); selectMode ? toggleSelect(animal.id) : router.push(`/dashboard/animals/${animal.id}`) }}
                  >
                    {selectMode && (
                      <td className="px-3 py-3" onClick={e => { e.stopPropagation(); toggleSelect(animal.id); }}>
                        {selectedIds.has(animal.id)
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : <Square className="h-4 w-4 text-muted-foreground" />}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
                        <Image
                          src={getAnimalImageUrl(animal)}
                          alt={animal.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/animals/${animal.id}`} className="hover:underline font-semibold text-base">
                        {animal.name}
                      </Link>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        #{animal.public_code}
                        {animal.identifiers?.find((i: AnimalIdentifier) => i.type === 'microchip') && (
                          <span className="inline-flex items-center gap-0.5 font-mono text-[10px] bg-muted border border-border rounded px-1 py-0 leading-4" title="Čip">
                            🔖 {animal.identifiers.find((i: AnimalIdentifier) => i.type === 'microchip')!.value}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {animal.species}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {animal.breeds && animal.breeds.length > 0
                        ? animal.breeds.map(b => formatBreedName(b)).join(', ')
                        : '—'}
                    </td>
<td className="px-4 py-3 text-muted-foreground">
                      {animal.estimated_age_years != null
                        ? `${animal.estimated_age_years} r.`
                        : (animal.age_group !== 'unknown' ? AGE_LABELS[animal.age_group] ?? '—' : '—')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid grid-cols-3 gap-1">
                        {/* Neutered / Spayed - only show when altered */}
                        {(animal.altered_status === 'neutered' || animal.altered_status === 'spayed') && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-green-100"
                            title={animal.species === 'cat'
                              ? (animal.sex === 'male' ? t('animals.health.neuteredCatMale') : t('animals.health.neuteredCatFemale'))
                              : (animal.sex === 'male' ? t('animals.health.neuteredDogMale') : t('animals.health.neuteredDogFemale'))
                            }
                          >
                            <Scissors className="h-3.5 w-3.5 text-green-600" />
                          </div>
                        )}
                        {/* Dewormed — only shown when true */}
                        {animal.is_dewormed && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-green-100"
                            title={t('animals.health.dewormed')}
                          >
                            <Pill className="h-3.5 w-3.5 text-green-600" />
                          </div>
                        )}
                        {/* Aggressive */}
                        {animal.is_aggressive && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-red-100"
                            title={t('animals.health.aggressiveWarning')}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          </div>
                        )}
                        {/* Pregnant */}
                        {animal.is_pregnant && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-pink-100"
                            title={t('animals.health.pregnant')}
                          >
                            <Baby className="h-3.5 w-3.5 text-pink-500" />
                          </div>
                        )}
                        {/* Lactating */}
                        {animal.is_lactating && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-amber-100"
                            title={t('animals.health.lactating')}
                          >
                            <Milk className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                        )}
                        {/* Critical */}
                        {animal.is_critical && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-red-100"
                            title={t('animals.health.critical')}
                          >
                            <Zap className="h-3.5 w-3.5 text-red-600" />
                          </div>
                        )}
                        {/* Diabetic */}
                        {animal.is_diabetic && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-100"
                            title={t('animals.health.diabetic')}
                          >
                            <Syringe className="h-3.5 w-3.5 text-blue-600" />
                          </div>
                        )}
                        {/* Cancer */}
                        {animal.is_cancer && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-rose-100"
                            title={t('animals.health.cancer')}
                          >
                            <Heart className="h-3.5 w-3.5 text-rose-600" />
                          </div>
                        )}
                        {/* Special needs */}
                        {animal.is_special_needs && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-violet-100"
                            title="Speciální potřeby"
                          >
                            <Accessibility className="h-3.5 w-3.5 text-violet-600" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${getStatusColor(animal.status)}`}>
                        {t(`animals.status.${animal.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {animal.current_kennel_id ? (
                        <Link
                          href={`/dashboard/kennels/${animal.current_kennel_id}`}
                          className="hover:underline text-primary font-mono"
                          onClick={e => e.stopPropagation()}
                        >
                          {animal.current_kennel_code}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {animal.current_intake_date ? new Date(animal.current_intake_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/animals/${animal.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filtered.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No animals found</p>
            <Link href="/dashboard/animals/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add your first animal
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Bulk selection bottom bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border shadow-lg rounded-full px-5 py-2.5">
          <span className="text-sm font-medium">{selectedIds.size} zvířat vybráno</span>
          <Button size="sm" onClick={() => setBulkTaskOpen(true)}>
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Vytvořit úkol
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Zrušit výběr
          </Button>
        </div>
      )}

      {/* Bulk task dialog */}
      <Dialog open={bulkTaskOpen} onOpenChange={setBulkTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hromadný úkol pro {selectedIds.size} zvířat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Název úkolu *</Label>
              <Input
                value={bulkTaskForm.title}
                onChange={e => setBulkTaskForm(p => ({ ...p, title: e.target.value }))}
                placeholder="např. Pravidelné odčervení"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Typ</Label>
                <Select value={bulkTaskForm.task_type} onValueChange={v => setBulkTaskForm(p => ({ ...p, task_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medical">Veterinární</SelectItem>
                    <SelectItem value="general">Obecný</SelectItem>
                    <SelectItem value="feeding">Krmení</SelectItem>
                    <SelectItem value="cleaning">Úklid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priorita</Label>
                <Select value={bulkTaskForm.priority} onValueChange={v => setBulkTaskForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgentní</SelectItem>
                    <SelectItem value="high">Vysoká</SelectItem>
                    <SelectItem value="medium">Střední</SelectItem>
                    <SelectItem value="low">Nízká</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Termín</Label>
              <Input
                type="datetime-local"
                value={bulkTaskForm.due_at}
                onChange={e => setBulkTaskForm(p => ({ ...p, due_at: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Poznámky</Label>
              <Input
                value={bulkTaskForm.notes}
                onChange={e => setBulkTaskForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Volitelné poznámky"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setBulkTaskOpen(false)} disabled={creatingBulkTask}>
                Zrušit
              </Button>
              <Button onClick={handleBulkCreateTask} disabled={creatingBulkTask || !bulkTaskForm.title}>
                {creatingBulkTask ? <Loader2 className="h-4 w-4 animate-spin" /> : `Vytvořit ${selectedIds.size} úkolů`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create choice dialog */}
      <Dialog open={createChoiceOpen} onOpenChange={setCreateChoiceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('animals.createChoice.title')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => { setCreateChoiceOpen(false); router.push('/dashboard/animals/new'); }}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-border p-4 text-left hover:border-primary hover:bg-accent transition-colors"
            >
              <div className="text-2xl">📋</div>
              <div>
                <p className="font-semibold text-sm">{t('animals.createChoice.animalOnly')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('animals.createChoice.animalOnlyDesc')}</p>
              </div>
            </button>
            <button
              onClick={() => { setCreateChoiceOpen(false); router.push('/dashboard/intake/new'); }}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-border p-4 text-left hover:border-primary hover:bg-accent transition-colors"
            >
              <div className="text-2xl">🏠</div>
              <div>
                <p className="font-semibold text-sm">{t('animals.createChoice.withIntake')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('animals.createChoice.withIntakeDesc')}</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export button - bottom right */}
      {canExport && animals.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2 shadow-lg"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      )}
    </div>
  );
}
