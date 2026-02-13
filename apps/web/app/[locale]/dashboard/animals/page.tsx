'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search, Loader2, LayoutGrid, List, ArrowRight, Scissors, Pill, AlertTriangle, Baby } from 'lucide-react';
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

export default function AnimalsPage() {
  const t = useTranslations();
  const tSpecies = useTranslations('animals.species');
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
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

  const filtered = animals.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesSpecies = !speciesFilter || a.species === speciesFilter;
    return matchesSearch && matchesSpecies;
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
                {/* Square thumbnail — object-contain so no crop */}
                <div className="relative w-full aspect-square bg-muted flex items-center justify-center">
                  <Image
                    src={getAnimalImageUrl(animal)}
                    alt={animal.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  {/* Sex badge in top-right corner */}
                  {animal.sex !== 'unknown' && (
                    <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white text-base font-bold leading-none">
                      {animal.sex === 'male' ? '♂' : '♀'}
                    </div>
                  )}
                  {/* Kennel code badge bottom-left */}
                  {animal.current_kennel_code && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono font-semibold">
                      {animal.current_kennel_code}
                    </div>
                  )}
                </div>
                <div className="p-2.5 space-y-1.5">
                  <p className="font-bold text-lg leading-tight truncate">{animal.name}</p>
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Color</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground w-28" title="Zdraví">Zdraví</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kotec</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Intake</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((animal) => (
                  <tr key={animal.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
                        <Image
                          src={getAnimalImageUrl(animal)}
                          alt={animal.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          animal.sex === 'male' ? 'bg-blue-500 text-white' : animal.sex === 'female' ? 'bg-pink-500 text-white' : 'bg-gray-400 text-white'
                        }`}>
                          {animal.sex === 'male' ? '♂' : animal.sex === 'female' ? '♀' : '?'}
                        </div>
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
                        ? animal.breeds.map(b => b.display_name || b.breed_name).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {animal.color || '—'}
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
                        {/* Dewormed */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center ${animal.is_dewormed ? 'bg-green-100' : 'bg-gray-100'}`}
                          title={t('animals.health.dewormed')}
                        >
                          <Pill className={`h-3.5 w-3.5 ${animal.is_dewormed ? 'text-green-600' : 'text-gray-300'}`} />
                        </div>
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
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${getStatusColor(animal.status)}`}>
                        {animal.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {animal.current_kennel_code ?? '—'}
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
