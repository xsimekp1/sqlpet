'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import ApiClient, { Animal } from '@/app/lib/api';
import { toast } from 'sonner';

export default function AnimalsPage() {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch animals from API
  useEffect(() => {
    const fetchAnimals = async () => {
      try {
        setLoading(true);
        const data = await ApiClient.getAnimals();
        setAnimals(data);
      } catch (error) {
        toast.error('Failed to load animals');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnimals();
  }, []);

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

        <Link href="/dashboard/animals/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Animal
          </Button>
        </Link>
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

      {/* Animals Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {animals.map((animal) => (
            <Link key={animal.id} href={`/dashboard/animals/${animal.id}`}>
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {animal.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      #{animal.public_code}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {animal.species} • {animal.sex === 'MALE' ? '♂' : animal.sex === 'FEMALE' ? '♀' : '?'}
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
                      <span className="font-medium text-green-600">{animal.status}</span>
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
      )}

      {animals.length === 0 && (
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
