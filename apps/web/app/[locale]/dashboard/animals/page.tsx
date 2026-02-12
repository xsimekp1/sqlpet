'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search, Loader2, LayoutGrid, List, ArrowRight, Scissors } from 'lucide-react';
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

export default function AnimalsPage() {
  const t = useTranslations();
  const [search, setSearch] = useState('');
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

  const filtered = animals.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

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
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Animals Grid / Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((animal) => (
            <Link key={animal.id} href={`/dashboard/animals/${animal.id}`}>
              <Card className="hover:bg-accent transition-colors cursor-pointer overflow-hidden">
                {/* Thumbnail */}
                <div className="relative w-full aspect-video bg-muted">
                  <Image
                    src={getAnimalImageUrl(animal)}
                    alt={animal.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <CardHeader className="pb-2">
                  <CardTitle>{animal.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5">
                    {animal.species} • {animal.sex === 'male' ? '♂' : animal.sex === 'female' ? '♀' : '?'}
                    {(animal.altered_status === 'neutered' || animal.altered_status === 'spayed') && (
                      <Scissors className="inline h-3 w-3 text-primary" title={animal.altered_status === 'spayed' ? t('animals.alteredStatus.spayed') : t('animals.alteredStatus.neutered')} />
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    {animal.color && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Color:</span>
                        <span className="font-medium">{animal.color}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className={`text-xs ${getStatusColor(animal.status)}`}>
                        {animal.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Intake:</span>
                      <span>{new Date(animal.intake_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
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
                  <th className="px-4 py-3 font-medium text-muted-foreground w-10" title={t('animals.alteredStatus.label')}>
                    <Scissors className="h-4 w-4" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Intake</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((animal) => (
                  <tr key={animal.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="relative h-8 w-8 rounded-full overflow-hidden bg-muted shrink-0">
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
                      <Link href={`/dashboard/animals/${animal.id}`} className="hover:underline font-medium">
                        {animal.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">#{animal.public_code}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {animal.species} {animal.sex === 'male' ? '♂' : animal.sex === 'female' ? '♀' : '?'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {animal.breeds && animal.breeds.length > 0
                        ? animal.breeds.map(b => b.breed_name).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {animal.color || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {animal.altered_status === 'neutered' || animal.altered_status === 'spayed' ? (
                        <Scissors className="h-4 w-4 text-primary" title={animal.altered_status === 'spayed' ? t('animals.alteredStatus.spayed') : t('animals.alteredStatus.neutered')} />
                      ) : animal.altered_status === 'intact' ? (
                        <Scissors className="h-4 w-4 text-muted-foreground/30" title={t('animals.alteredStatus.intact')} />
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${getStatusColor(animal.status)}`}>
                        {animal.status}
                      </Badge>
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
