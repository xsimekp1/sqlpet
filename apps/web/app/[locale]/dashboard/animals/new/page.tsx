'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ApiClient from '@/app/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Breed {
  id: string;
  name: string;
  species: string;
}

export default function NewAnimalPage() {
  const router = useRouter();
  const t = useTranslations('animals.new');
  const [loading, setLoading] = useState(false);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [selectedBreed, setSelectedBreed] = useState<string>('');

  // Fetch breeds when species changes
  useEffect(() => {
    if (!selectedSpecies) {
      setBreeds([]);
      setSelectedBreed('');
      return;
    }

    const fetchBreeds = async () => {
      try {
        const data = await ApiClient.getBreeds(selectedSpecies);
        setBreeds(data);
      } catch (error) {
        console.error('Failed to fetch breeds:', error);
        setBreeds([]);
      }
    };

    fetchBreeds();
  }, [selectedSpecies]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const data: any = {
      name: formData.get('name') as string,
      species: formData.get('species') as 'dog' | 'cat' | 'rabbit' | 'other',
      sex: formData.get('sex') as 'male' | 'female' | 'unknown',
      color: (formData.get('color') as string) || null,
      intake_date: formData.get('intake_date') as string,
      status: 'available',
    };

    // Add breed if selected
    if (selectedBreed) {
      data.breeds = [{ breed_id: selectedBreed }];
    }

    try {
      await ApiClient.createAnimal(data);
      toast.success(t('success'));
      router.push('/dashboard/animals');
    } catch (error) {
      toast.error(t('error'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/animals">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
         <Card>
           <CardHeader>
             <CardTitle>{t('basicInfo')}</CardTitle>
             <CardDescription>
               {t('basicInfoDesc')}
             </CardDescription>
           </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                name="name"
                placeholder={t('namePlaceholder')}
                required
              />
            </div>

            {/* Species & Sex */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="species">{t('species')}</Label>
                <Select name="species" required onValueChange={setSelectedSpecies}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('speciesPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dog">Dog</SelectItem>
                    <SelectItem value="cat">Cat</SelectItem>
                    <SelectItem value="rabbit">Rabbit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sex">{t('sex')}</Label>
                <Select name="sex" required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('sexPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Breed (only shown after species selected) */}
            {selectedSpecies && (
              <div className="space-y-2">
                <Label htmlFor="breed">{t('breed')}</Label>
                <Select value={selectedBreed} onValueChange={setSelectedBreed}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('breedPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {breeds.length === 0 ? (
                      <SelectItem value="none" disabled>{t('breedLoading')}</SelectItem>
                    ) : (
                      breeds.map(breed => (
                        <SelectItem key={breed.id} value={breed.id}>
                          {breed.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Color & Age */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">{t('color')}</Label>
                <Input
                  id="color"
                  name="color"
                  placeholder={t('colorPlaceholder')}
                />
              </div>

              {/* TODO: M3+ - Add age fields (birth_date_estimated, age_group) to match backend schema */}
              {/* <div className="space-y-2">
                <Label htmlFor="estimated_age_years">{t('estimatedAge')}</Label>
                <Input
                  id="estimated_age_years"
                  name="estimated_age_years"
                  type="number"
                  min="0"
                  max="30"
                  placeholder={t('estimatedAgePlaceholder')}
                />
              </div> */}
            </div>

            {/* Intake Date */}
            <div className="space-y-2">
              <Label htmlFor="intake_date">{t('intakeDate')}</Label>
              <Input
                id="intake_date"
                name="intake_date"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? t('creating') : t('create')}
              </Button>
              <Link href="/dashboard/animals">
                <Button type="button" variant="outline">
                  {t('cancel')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
