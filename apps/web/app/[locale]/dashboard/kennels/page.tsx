'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus, Search, Loader2, Grid, Table, Settings,
  Footprints, MoreHorizontal, Users, Edit,
  ArrowRight
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ApiClient, { Kennel, KennelAnimal, Animal } from '@/app/lib/api';
import { getAnimalImageUrl } from '@/app/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import { AddKennelDialog } from '@/app/components/kennels/AddKennelDialog';


interface FilterState {
  zone_id: string;
  status: string;
  type: string;
  size_category: string;
  occupancy: string;
}

const generateKennelCode = (kennel: Kennel): string => {
  if (kennel.code && kennel.code.length <= 10) {
    return kennel.code;
  }
  const nameWords = kennel.name.trim().split(/\s+/);
  const firstLetters = nameWords.map(word => word[0].toUpperCase()).slice(0, 2).join('');
  const prefix = firstLetters.length >= 2 ? firstLetters : kennel.type.toUpperCase().substring(0, 2);
  return prefix + '1';
};

// ---- Draggable chip (small animal pill) ----
function DraggableAnimalChip({ animal }: { animal: Animal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: animal.id,
    data: { animal },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  const imageUrl = getAnimalImageUrl(animal);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center gap-2 px-2.5 py-1.5 bg-background border rounded-lg shadow-sm cursor-grab active:cursor-grabbing select-none hover:border-primary/50 transition-colors"
    >
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-muted">
        <Image
          src={imageUrl}
          alt={animal.name}
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
      <span className="text-sm font-medium max-w-[100px] truncate">{animal.name}</span>
    </div>
  );
}

// Static chip for display inside kennel cards (not draggable standalone — animals inside kennels are also draggable)
function DraggableKennelAnimalChip({ animal }: { animal: Animal }) {
  return <DraggableAnimalChip animal={animal} />;
}

// Non-draggable chip used in DragOverlay
function AnimalChipPreview({ animal }: { animal: Animal }) {
  const imageUrl = getAnimalImageUrl(animal);
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-background border border-primary rounded-lg shadow-lg cursor-grabbing select-none">
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-muted">
        <Image
          src={imageUrl}
          alt={animal.name}
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
      <span className="text-sm font-medium max-w-[100px] truncate">{animal.name}</span>
    </div>
  );
}

const UNHOUSED_ZONE_ID = '__unhoused__';

// ---- Droppable "no kennel" zone ----
function DroppableUnhousedZone({ animals }: { animals: Animal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNHOUSED_ZONE_ID });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-wrap gap-2 p-3 rounded-lg border border-dashed min-h-[56px] transition-colors ${
        isOver ? 'bg-blue-50 border-blue-400' : 'bg-muted/50'
      }`}
    >
      {animals.length === 0 && (
        <span className={`text-sm self-center ${isOver ? 'text-blue-600' : 'text-muted-foreground'}`}>
          {isOver ? 'Pustit pro odebrání z kotce' : 'Přetáhněte sem pro odebrání z kotce'}
        </span>
      )}
      {animals.map(animal => (
        <DraggableAnimalChip key={animal.id} animal={animal} />
      ))}
    </div>
  );
}

// ---- Droppable kennel card ----
function DroppableKennelCard({
  kennel,
  allAnimals,
  t,
  getZoneColor,
  getOccupancyStatusColor,
  getOccupancyStatus,
}: {
  kennel: Kennel;
  allAnimals: Animal[];
  t: ReturnType<typeof useTranslations<'kennels'>>;
  getZoneColor: (id: string) => string;
  getOccupancyStatusColor: (o: number, c: number) => string;
  getOccupancyStatus: (o: number, c: number) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: kennel.id });
  const isFull = kennel.occupied_count >= kennel.capacity;

  // Use allAnimals filtered by current_kennel_id for live optimistic updates
  const animalsInKennel = allAnimals.filter(a => a.current_kennel_id === kennel.id);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-card text-card-foreground shadow-sm transition-all ${
        isFull ? 'border-red-400' : ''
      } ${isOver ? 'border-2 border-primary bg-primary/5 ring-2 ring-primary/20' : ''}`}
    >
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-bold shrink-0">{kennel.code}</span>
            <span className="text-sm text-muted-foreground truncate">{kennel.name}</span>
            {kennel.zone_name && (
              <Badge className={`${getZoneColor(kennel.zone_id)} shrink-0`} variant="outline">
                {kennel.zone_name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link href={`/dashboard/kennels/${kennel.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="p-3 pt-0">
        {/* Animal chips */}
        <div className="mb-2.5 min-h-[44px]">
          {animalsInKennel.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {animalsInKennel.map(animal => (
                <DraggableKennelAnimalChip key={animal.id} animal={animal} />
              ))}
            </div>
          ) : (
            <div className={`flex items-center justify-center h-11 rounded border border-dashed text-xs text-muted-foreground ${isOver ? 'border-primary text-primary' : ''}`}>
              {isOver ? 'Přetáhněte sem' : t('occupancy.empty')}
            </div>
          )}
        </div>

        {/* Simple footer: size • count/capacity • status */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{kennel.size_category}</span>
          <div className="flex items-center gap-1.5">
            <span>{kennel.occupied_count}/{kennel.capacity}</span>
            <Badge className={`text-xs ${getOccupancyStatusColor(kennel.occupied_count, kennel.capacity)}`}>
              {t(`occupancy.${getOccupancyStatus(kennel.occupied_count, kennel.capacity)}` as any)}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Format animal names for table view ----
function formatAnimalNames(animals: KennelAnimal[], total: number) {
  if (total === 0) return <span className="text-muted-foreground text-sm">Prázdný</span>;
  const shown = animals.slice(0, 2);
  const rest = total - shown.length;
  const names = shown.map(a => a.name).join(', ');
  if (rest > 0) return <span className="text-sm">{names} a {rest} další</span>;
  return <span className="text-sm">{names}</span>;
}

export default function KennelsPage() {
  const t = useTranslations('kennels');
  const [search, setSearch] = useState('');
  const [kennels, setKennels] = useState<Kennel[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'grid'>('grid');
  const [activeAnimal, setActiveAnimal] = useState<Animal | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    zone_id: '',
    status: '',
    type: '',
    size_category: '',
    occupancy: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params: Record<string, string> = {};
      if (filters.zone_id) params.zone_id = filters.zone_id;
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      if (filters.size_category) params.size_category = filters.size_category;
      if (search) params.q = search;

      const [kennelsData, animalsData] = await Promise.all([
        ApiClient.getKennels(params),
        ApiClient.getAnimals({ page_size: 100 }),
      ]);
      setKennels(kennelsData);
      setAllAnimals(animalsData.items);
    } catch (error) {
      toast.error('Failed to load kennels');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDragStart = (event: DragStartEvent) => {
    const animal = allAnimals.find(a => a.id === event.active.id);
    setActiveAnimal(animal || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAnimal(null);
    if (!over || active.id === over.id) return;

    const animalId = active.id as string;
    const animal = allAnimals.find(a => a.id === animalId);
    if (!animal) return;

    // ── Drop on "no kennel" zone → remove from kennel ──────────────────────
    if (over.id === UNHOUSED_ZONE_ID) {
      if (!animal.current_kennel_id) return; // already unhoused
      const prevAnimals = allAnimals;
      setAllAnimals(prev =>
        prev.map(a => a.id === animalId
          ? { ...a, current_kennel_id: null, current_kennel_name: null, current_kennel_code: null }
          : a
        )
      );
      try {
        await ApiClient.moveAnimal({ animal_id: animalId, target_kennel_id: null });
        const movedVerb = animal.sex === 'female' ? 'odebrána' : 'odebrán';
        toast.success(`${animal.name} ${movedVerb} z kotce`);
        await fetchData(true);
      } catch (e: any) {
        toast.error('Nelze odebrat z kotce: ' + (e.message || 'Neznámá chyba'));
        setAllAnimals(prevAnimals);
      }
      return;
    }

    // ── Drop on a kennel card ────────────────────────────────────────────────
    const targetKennelId = over.id as string;
    const targetKennel = kennels.find(k => k.id === targetKennelId);
    if (!targetKennel) return;
    if (animal.current_kennel_id === targetKennelId) return;

    // Warning: aggressive animal with other animals in kennel
    if (animal.is_aggressive && targetKennel.occupied_count > 0) {
      toast.warning(`${animal.name} je agresivní a v kotci ${targetKennel.name} je ${targetKennel.occupied_count} zvíře!`);
    }

    // Warning: other aggressive animal already in kennel
    const existingAggressive = targetKennel.animals_preview?.some(a => a.is_aggressive);
    if (!animal.is_aggressive && existingAggressive) {
      toast.warning(`V kotci ${targetKennel.name} je již agresivní zvíře!`);
    }

    // Warning: opposite sex unneutered animals in same kennel
    const isNeutered = animal.altered_status === 'neutered' || animal.altered_status === 'spayed';
    const oppositeSex = targetKennel.animals_preview?.some(a => 
      a.sex && animal.sex && a.sex !== animal.sex && 
      a.altered_status !== 'neutered' && a.altered_status !== 'spayed'
    );
    if (!isNeutered && oppositeSex) {
      toast.warning(`${animal.name} není kastrovaný/á a v kotci ${targetKennel.name} je zvíře opačného pohlaví! ❤️`);
    }

    // Warning: different species in same kennel
    const differentSpecies = targetKennel.animals_preview?.some(a => a.species !== animal.species);
    if (differentSpecies) {
      toast.warning(`${animal.name} (${animal.species}) a zvíře v kotci ${targetKennel.name} jsou různé druhy! 🐾`);
    }

    // Warning: species not suitable for this kennel
    const suitable = targetKennel.allowed_species;
    if (suitable && suitable.length > 0 && !suitable.includes(animal.species)) {
      toast.warning(`${animal.name} (${animal.species}) není vhodný/á pro tento kotec! 🏠`);
    }

    const prevKennels = kennels;
    const prevAnimals = allAnimals;

    setAllAnimals(prev =>
      prev.map(a => a.id === animalId
        ? { ...a, current_kennel_id: targetKennelId, current_kennel_name: targetKennel.name, current_kennel_code: targetKennel.code }
        : a
      )
    );

    try {
      await ApiClient.moveAnimal({ animal_id: animalId, target_kennel_id: targetKennelId });
      const movedVerb = animal.sex === 'female' ? 'přesunuta' : 'přesunut';
      toast.success(`${animal.name} ${movedVerb} do ${targetKennel.name}`);
      await fetchData(true);
    } catch (e: any) {
      toast.error('Nelze přesunout: ' + (e.message || 'Neznámá chyba'));
      setKennels(prevKennels);
      setAllAnimals(prevAnimals);
    }
  };

  const getOccupancyStatusColor = (occupied: number, capacity: number) => {
    if (occupied === 0) return 'bg-gray-100 text-gray-800';
    if (occupied < capacity) return 'bg-green-100 text-green-800';
    if (occupied === capacity) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getOccupancyStatus = (occupied: number, capacity: number) => {
    if (occupied === 0) return 'empty';
    if (occupied < capacity) return 'partial';
    if (occupied === capacity) return 'full';
    return 'over';
  };

  const getZoneColor = (zoneId: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-blue-100 text-blue-800',
      'B': 'bg-green-100 text-green-800',
      'C': 'bg-purple-100 text-purple-800',
      'D': 'bg-orange-100 text-orange-800',
    };
    return colors[zoneId[0]?.toUpperCase()] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'available': return 'default';
      case 'maintenance': return 'secondary';
      case 'closed': return 'destructive';
      default: return 'outline';
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'indoor': 'bg-blue-100 text-blue-800',
      'outdoor': 'bg-green-100 text-green-800',
      'isolation': 'bg-red-100 text-red-800',
      'quarantine': 'bg-yellow-100 text-yellow-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const filteredKennels = kennels.filter(kennel => {
    const matchesSearch = !search ||
      kennel.code.toLowerCase().includes(search.toLowerCase()) ||
      kennel.name.toLowerCase().includes(search.toLowerCase()) ||
      kennel.animals_preview?.some(animal =>
        animal.name.toLowerCase().includes(search.toLowerCase())
      );
    const matchesZone = !filters.zone_id || kennel.zone_id === filters.zone_id;
    const matchesStatus = !filters.status || kennel.status === filters.status;
    const matchesType = !filters.type || kennel.type === filters.type;
    const matchesSize = !filters.size_category || kennel.size_category === filters.size_category;
    const occStatus = getOccupancyStatus(kennel.occupied_count, kennel.capacity);
    const matchesOccupancy = !filters.occupancy || occStatus === filters.occupancy;
    return matchesSearch && matchesZone && matchesStatus && matchesType && matchesSize && matchesOccupancy;
  });

  // Animals without a kennel assignment
  const unhousedAnimals = allAnimals.filter(a => !a.current_kennel_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView(view === 'table' ? 'grid' : 'table')}
          >
            {view === 'table' ? <Grid className="h-4 w-4 mr-1" /> : <Table className="h-4 w-4 mr-1" />}
            {t(`view.${view === 'table' ? 'grid' : 'table'}` as any)}
          </Button>
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            {t('quickActions.manageZones')}
          </Button>
          <Button variant="outline" className="gap-2">
            <Footprints className="h-4 w-4" />
            {t('quickActions.walkMode')}
          </Button>
          <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" />
            {t('quickActions.addKennel')}
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filters.status || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder={t('filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.status')}</SelectItem>
                <SelectItem value="available">{t('status.available')}</SelectItem>
                <SelectItem value="maintenance">{t('status.maintenance')}</SelectItem>
                <SelectItem value="closed">{t('status.closed')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.type || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, type: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder={t('filters.type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.type')}</SelectItem>
                <SelectItem value="indoor">{t('type.indoor')}</SelectItem>
                <SelectItem value="outdoor">{t('type.outdoor')}</SelectItem>
                <SelectItem value="isolation">{t('type.isolation')}</SelectItem>
                <SelectItem value="quarantine">{t('type.quarantine')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.occupancy || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, occupancy: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder={t('filters.occupancy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.occupancy')}</SelectItem>
                <SelectItem value="empty">{t('occupancy.empty')}</SelectItem>
                <SelectItem value="partial">{t('occupancy.partial')}</SelectItem>
                <SelectItem value="full">{t('occupancy.full')}</SelectItem>
                <SelectItem value="over">{t('occupancy.over')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Grid View with DnD */}
      {view === 'grid' ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Unhoused animals bar — always visible, droppable */}
          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Zvířata bez kotce ({unhousedAnimals.length})
            </p>
            <DroppableUnhousedZone animals={unhousedAnimals} />
          </div>

          {/* Kennel grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredKennels.map(kennel => (
              <DroppableKennelCard
                key={kennel.id}
                kennel={kennel}
                allAnimals={allAnimals}
                t={t}
                getZoneColor={getZoneColor}
                getOccupancyStatusColor={getOccupancyStatusColor}
                getOccupancyStatus={getOccupancyStatus}
              />
            ))}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeAnimal ? <AnimalChipPreview animal={activeAnimal} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Table View */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Kód</th>
                  <th className="text-left p-3">Název</th>
                  <th className="text-left p-3">Zóna</th>
                  <th className="text-left p-3">Typ</th>
                  <th className="text-left p-3">Velikost</th>
                  <th className="text-left p-3">Kapacita</th>
                  <th className="text-left p-3">Stav</th>
                  <th className="text-left p-3">Zvířata</th>
                  <th className="text-left p-3">Akce</th>
                </tr>
              </thead>
              <tbody>
                {filteredKennels.map(kennel => (
                  <tr key={kennel.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">
                      <Link href={`/dashboard/kennels/${kennel.id}`} className="hover:text-primary">
                        {kennel.code}
                      </Link>
                    </td>
                    <td className="p-3">{kennel.name}</td>
                    <td className="p-3">
                      <Badge className={getZoneColor(kennel.zone_id)} variant="outline">
                        {kennel.zone_name || kennel.zone_id}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={getTypeColor(kennel.type)} variant="outline">
                        {t(`type.${kennel.type}` as any)}
                      </Badge>
                    </td>
                    <td className="p-3 capitalize">{kennel.size_category}</td>
                    <td className="p-3">{kennel.capacity}</td>
                    <td className="p-3">
                      <Badge variant={getStatusColor(kennel.status)}>
                        {t(`status.${kennel.status}` as any)}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {formatAnimalNames(kennel.animals_preview, kennel.occupied_count)}
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Users className="h-4 w-4 mr-2" />
                            Move Animals
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Set Maintenance
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filteredKennels.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {t(`noResults.${search || Object.values(filters).some(v => v) ? 'withFilter' : 'noFilter'}` as any)}
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('quickActions.addKennel')}
            </Button>
          </CardContent>
        </Card>
      )}

      <AddKennelDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={fetchData}
      />
    </div>
  );
}
