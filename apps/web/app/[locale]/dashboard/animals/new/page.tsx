'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, ImageOff } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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
  display_name: string;
}

interface ColorImage {
  color: string;
  image_url: string;
}

export default function NewAnimalPage() {
  const router = useRouter();
  const t = useTranslations('animals.new');
  const tColors = useTranslations('animals.colors');
  const tSpecies = useTranslations('animals.species');
  const tSex = useTranslations('animals.sex');
  const locale = useLocale();

  const [loading, setLoading] = useState(false);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [colorImages, setColorImages] = useState<ColorImage[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [selectedBreed, setSelectedBreed] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [loadingColors, setLoadingColors] = useState(false);

  // Fetch breeds when species changes
  useEffect(() => {
    if (!selectedSpecies) {
      setBreeds([]);
      setSelectedBreed('');
      setColorImages([]);
      setSelectedColor('');
      setPreviewImageUrl('');
      return;
    }

    const fetchBreeds = async () => {
      try {
        const data = await ApiClient.getBreeds(selectedSpecies, locale);
        setBreeds(data);
      } catch (error) {
        console.error('Failed to fetch breeds:', error);
        setBreeds([]);
      }
    };

    fetchBreeds();
  }, [selectedSpecies, locale]);

  // Fetch available colors when breed changes
  useEffect(() => {
    if (!selectedBreed) {
      setColorImages([]);
      setSelectedColor('');
      setPreviewImageUrl('');
      return;
    }

    const fetchColors = async () => {
      setLoadingColors(true);
      try {
        const data = await ApiClient.getBreedColorImages(selectedBreed);
        setColorImages(data);
      } catch (error) {
        console.error('Failed to fetch breed colors:', error);
        setColorImages([]);
      } finally {
        setLoadingColors(false);
      }
    };

    fetchColors();
    setSelectedColor('');
    setPreviewImageUrl('');
  }, [selectedBreed]);

  // Update preview image when color changes
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    const match = colorImages.find((ci) => ci.color === color);
    setPreviewImageUrl(match?.image_url || '');
  };

  const handleSpeciesChange = (value: string) => {
    setSelectedSpecies(value);
    setSelectedBreed('');
    setSelectedColor('');
    setPreviewImageUrl('');
  };

  const handleBreedChange = (value: string) => {
    setSelectedBreed(value);
    setSelectedColor('');
    setPreviewImageUrl('');
  };

  // Translate color name, fallback to raw value
  const getColorLabel = (color: string): string => {
    try {
      return tColors(color as any);
    } catch {
      return color.replace(/_/g, ' ').replace(/-/g, ' ');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const data: any = {
      name: formData.get('name') as string,
      species: formData.get('species') as string,
      sex: formData.get('sex') as string,
      color: selectedColor || null,
      status: 'available',
    };

    if (selectedBreed) {
      data.breeds = [{ breed_id: selectedBreed }];
    }

    try {
      const newAnimal = await ApiClient.createAnimal(data);
      toast.success(t('success'));
      try {
        const foodsResp = await ApiClient.get('/feeding/foods');
        const allFoods: any[] = foodsResp?.items ?? foodsResp ?? [];
        const hasFood = allFoods.some(
          (f: any) => !f.species || f.species === data.species
        );
        if (!hasFood) {
          toast.warning('Upozornění: V inventáři není žádné krmivo vhodné pro tento druh zvířete.');
        }
      } catch { /* non-critical */ }
      router.push(`/dashboard/animals/${newAnimal.id}`);
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
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form - takes 2/3 width on large screens */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('basicInfo')}</CardTitle>
                <CardDescription>{t('basicInfoDesc')}</CardDescription>
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
                    <Select
                      name="species"
                      required
                      onValueChange={handleSpeciesChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('speciesPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dog">{tSpecies('dog')}</SelectItem>
                        <SelectItem value="cat">{tSpecies('cat')}</SelectItem>
                        <SelectItem value="rabbit">{tSpecies('rabbit')}</SelectItem>
                        <SelectItem value="bird">{tSpecies('bird')}</SelectItem>
                        <SelectItem value="other">{tSpecies('other')}</SelectItem>
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
                        <SelectItem value="male">{tSex('male')}</SelectItem>
                        <SelectItem value="female">{tSex('female')}</SelectItem>
                        <SelectItem value="unknown">{tSex('unknown')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Breed (only shown after species selected) */}
                {selectedSpecies && (
                  <div className="space-y-2">
                    <Label htmlFor="breed">{t('breed')}</Label>
                    <Select value={selectedBreed} onValueChange={handleBreedChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('breedPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {breeds.length === 0 ? (
                          <SelectItem value="__loading" disabled>
                            {t('breedLoading')}
                          </SelectItem>
                        ) : (
                          breeds.map((breed) => (
                            <SelectItem key={breed.id} value={breed.id}>
                              {breed.display_name || breed.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Color (only shown after breed selected, as dropdown from images) */}
                {selectedBreed && (
                  <div className="space-y-2">
                    <Label htmlFor="color">{t('color')}</Label>
                    {loadingColors ? (
                      <p className="text-sm text-muted-foreground">{t('colorLoading')}</p>
                    ) : colorImages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('noColorsAvailable')}</p>
                    ) : (
                      <Select value={selectedColor} onValueChange={handleColorChange}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('colorPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {colorImages.map((ci) => (
                            <SelectItem key={ci.color} value={ci.color}>
                              {getColorLabel(ci.color)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

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
          </div>

          {/* Image preview - 1/3 width on large screens */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-base">{t('previewTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {previewImageUrl ? (
                  <div className="space-y-2">
                    <div className="rounded-lg overflow-hidden border bg-muted aspect-square relative">
                      <Image
                        src={previewImageUrl}
                        alt={`${selectedBreed} - ${selectedColor}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {t('defaultImageHint')}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted aspect-square flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <ImageOff className="h-10 w-10 opacity-30" />
                    <p className="text-xs text-center px-4">
                      {selectedBreed
                        ? t('colorPlaceholder')
                        : selectedSpecies
                        ? t('breedPlaceholder')
                        : t('speciesPlaceholder')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
