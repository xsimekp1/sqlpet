'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Search, Loader2, LayoutGrid, List, ArrowRight, Scissors, Pill, AlertTriangle, Baby, Accessibility, CheckSquare, Square, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  dog: '🐕', cat: '🐈', rabbit: '🐇', bird: '🐦', other: '🐾',
};

const AGE_LABELS: Record<string, string> = {
  baby: 'Mládě',
  young: 'Mladé',
  adult: 'Dospělé',
  senior: 'Senior',
};

function formatBreedName(b: { display_name?: string; breed_name: string }): string {
  if (b.display_name) return b.display_name;
  // Prettify slug: "akita-inu" → "Akita Inu"
  return b.breed_name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AnimalsPage() {
  const router = useRouter();
  const t = useTranslations();
  const tSpecies = useTranslations('animals.species');
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'available' | 'all'>('active');
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

  // Fetch animals from API
  useEffect(() => {
    const fetchAnimals = async () => {
      try {
        setLoading(true);
        const data = await ApiClient.getAnimals();
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
    return matchesSearch && matchesSpecies && matchesStatus;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('nav.animals')}
          </h1>
          <p className="text-muted-foreground mt-1">
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
          <Button className="gap-2" onClick={() => setCreateChoiceOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('animals.createChoice.withIntake')}
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find animals by name, species, or breed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search animals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          {/* Status filter chips */}
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => setStatusFilter('active')}
            >
              {t('animals.statusFilter.active')}
            </Button>
            <Button
              variant={statusFilter === 'available' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => setStatusFilter('available')}
            >
              {t('animals.statusFilter.available')}
            </Button>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2.5 rounded-full"
              onClick={() => setStatusFilter('all')}
            >
              {t('animals.statusFilter.all')}
            </Button>
          </div>
          {availableSpecies.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {availableSpecies.map((sp) => (
                <Button
                  key={sp}
                  variant={speciesFilter === sp ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2.5 rounded-full"
                  onClick={() => setSpeciesFilter(speciesFilter === sp ? null : sp)}
                >
                  {SPECIES_EMOJI[sp] || '🐾'} {tSpecies(sp as any)}
                  <span className="ml-1.5 opacity-60">{animals.filter(a => a.species === sp).length}</span>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
            <Link key={animal.id} href={`/dashboard/animals/${animal.id}`}>
              <Card className="hover:bg-accent transition-colors cursor-pointer overflow-hidden">
                {/* Square thumbnail — equal padding on all sides */}
                <div className="relative w-full aspect-square bg-muted overflow-hidden">
                  <Image
                    src={getAnimalImageUrl(animal)}
                    alt={animal.name}
                    fill
                    className="object-cover object-center"
                    unoptimized
                  />
                  {/* Special needs badge top-left */}
                  {animal.is_special_needs && (
                    <div className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-violet-600/80 flex items-center justify-center" title="Zvíře se speciálními potřebami">
                      <Accessibility className="h-4 w-4 text-white" />
                    </div>
                  )}
                  {/* Quarantine badge top-right */}
                  {animal.status === 'quarantine' && (
                    <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-amber-500/80 flex items-center justify-center" title="Karanténa">
                      <AlertTriangle className="h-4 w-4 text-white" />
                    </div>
                  )}
                  {/* Kennel code badge bottom-left */}
                  {animal.current_kennel_code && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono font-semibold">
                      {animal.current_kennel_code}
                    </div>
                  )}
                </div>
                <div className="p-1.5 space-y-1">
                  <p className="font-bold text-base leading-tight truncate">{animal.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {animal.current_kennel_code && <span className="font-mono mr-1">{animal.current_kennel_code}</span>}
                    {animal.age_group !== 'unknown' ? AGE_LABELS[animal.age_group] ?? '' : ''}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(animal.altered_status === 'neutered' || animal.altered_status === 'spayed') && (
                      <Scissors className="h-3 w-3 text-primary shrink-0" />
                    )}
                    <Badge className={`text-xs px-1.5 py-0 ${getStatusColor(animal.status)}`}>
                      {t(`animals.status.${animal.status}`)}
                    </Badge>
                    {animal.tags && animal.tags.length > 0 && animal.tags.slice(0, 2).map((tag: any) => (
                      <span key={tag.id} className="text-xs px-1.5 py-0 rounded-full border border-border bg-muted text-muted-foreground leading-5">
                        {tag.name}
                      </span>
                    ))}
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Species</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Breed</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Věk</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground w-28" title="Zdraví">Zdraví</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kotec</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Intake</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((animal) => (
                  <tr
                    key={animal.id}
                    className={`border-b hover:bg-muted/50 transition-colors cursor-pointer ${selectMode && selectedIds.has(animal.id) ? 'bg-primary/5' : ''}`}
                    onClick={() => selectMode ? toggleSelect(animal.id) : router.push(`/dashboard/animals/${animal.id}`)}
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
                      {animal.age_group !== 'unknown' ? AGE_LABELS[animal.age_group] ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {/* Neutered / Spayed */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center ${animal.altered_status === 'neutered' || animal.altered_status === 'spayed' ? 'bg-green-100' : 'bg-gray-100'}`}
                          title={t('animals.health.neutered')}
                        >
                          <Scissors className={`h-3.5 w-3.5 ${animal.altered_status === 'neutered' || animal.altered_status === 'spayed' ? 'text-green-600' : 'text-gray-300'}`} />
                        </div>
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
    </div>
  );
}
