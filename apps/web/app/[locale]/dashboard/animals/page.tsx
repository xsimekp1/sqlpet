'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Search, Loader2, LayoutGrid, List, ArrowRight, Scissors, Pill, AlertTriangle, Baby, Accessibility } from 'lucide-react';
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
import ApiClient, { Animal } from '@/app/lib/api';
import { getAnimalImageUrl } from '@/app/lib/utils';
import { toast } from 'sonner';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
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

  const INACTIVE_STATUSES = ['deceased', 'escaped', 'adopted', 'transferred', 'returned_to_owner', 'euthanized'];

  const filtered = animals.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesSpecies = !speciesFilter || a.species === speciesFilter;
    const matchesStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'available' ? a.status === 'available' :
      /* active */ !INACTIVE_STATUSES.includes(a.status);
    return matchesSearch && matchesSpecies && matchesStatus;
  });

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
            variant="outline"
            onClick={() => setView(v => v === 'grid' ? 'table' : 'grid')}
          >
            {view === 'grid' ? (
              <><List className="h-4 w-4 mr-2" />{t('animals.view.table')}</>
            ) : (
              <><LayoutGrid className="h-4 w-4 mr-2" />{t('animals.view.grid')}</>
            )}
          </Button>
          <Link href="/dashboard/animals/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Animal
            </Button>
          </Link>
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
                      {animal.status}
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
          ))}
        </div>
      ) : (
        /* Table view */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
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
                    className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/animals/${animal.id}`)}
                  >
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
                      <p className="text-xs text-muted-foreground">#{animal.public_code}</p>
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
                        {animal.status}
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
                      {new Date(animal.intake_date).toLocaleDateString()}
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
    </div>
  );
}
