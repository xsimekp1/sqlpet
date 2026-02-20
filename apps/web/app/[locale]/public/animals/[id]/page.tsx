'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Loader2, MapPin, PawPrint, Calendar, Ruler, Weight, Shield, Heart, Baby, Dog, Cat } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PublicAnimal {
  id: string;
  name: string;
  species: string;
  sex: string;
  status: string;
  age_group: string;
  color: string | null;
  coat: string | null;
  size_estimated: string | null;
  weight_current_kg: number | null;
  description: string | null;
  behavior_notes: string | null;
  primary_photo_url: string | null;
  public_code: string;
  organization_name: string | null;
  is_dewormed: boolean;
  is_aggressive: boolean;
  is_pregnant: boolean;
  is_special_needs: boolean;
  bcs: number | null;
  breeds: { primary: boolean; breed: string }[];
  identifiers: { type: string; value: string }[];
  current_kennel: {
    id: string;
    name: string;
    code: string;
    zone_name: string;
  } | null;
}

const SPECIES_CONFIG: Record<string, { emoji: string; label: string; icon: typeof Dog }> = {
  dog: { emoji: '🐕', label: 'Pes', icon: Dog },
  cat: { emoji: '🐈', label: 'Kočka', icon: Cat },
  bird: { emoji: '🐦', label: 'Pták', icon: PawPrint },
  rodent: { emoji: '🐹', label: 'Hlodavec', icon: PawPrint },
  other: { emoji: '🐾', label: 'Jiné', icon: PawPrint },
};

const SEX_LABELS: Record<string, string> = {
  male: 'Samec',
  female: 'Samice',
  unknown: 'Neznámé',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  available: { label: 'Hledá domov', color: 'bg-green-100 text-green-800' },
  intake: { label: 'Přijato', color: 'bg-blue-100 text-blue-800' },
  adopted: { label: 'Adoptován', color: 'bg-gray-100 text-gray-800' },
  foster: { label: 'Dočasná péče', color: 'bg-purple-100 text-purple-800' },
  with_owner: { label: 'S majitelem', color: 'bg-gray-100 text-gray-800' },
};

const AGE_GROUP_LABELS: Record<string, string> = {
  baby: 'Štěně/Koťátko',
  young: 'Mladý',
  adult: 'Dospělý',
  senior: 'Senior',
  unknown: 'Neznámý věk',
};

const SIZE_LABELS: Record<string, string> = {
  xs: 'Velmi malý',
  sm: 'Malý',
  md: 'Střední',
  lg: 'Velký',
  xl: 'Velmi velký',
  unknown: 'Neznámá velikost',
};

export default function PublicAnimalPage() {
  const params = useParams();
  const router = useRouter();
  const animalId = params.id as string;
  const [animal, setAnimal] = useState<PublicAnimal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnimal = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/animals/${animalId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Zvíře nenalezeno');
          } else {
            setError('Chyba při načítání');
          }
          return;
        }
        const data = await res.json();
        setAnimal(data);
      } catch (e) {
        setError('Chyba při načítání');
      } finally {
        setLoading(false);
      }
    };
    fetchAnimal();
  }, [animalId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !animal) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <PawPrint className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">{error || 'Zvíře nenalezeno'}</h1>
            <p className="text-muted-foreground mb-4">Toto zvíře bohužel není veřejně viditelné.</p>
            <Link href="/">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
                Zpět na úvod
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const species = SPECIES_CONFIG[animal.species] || SPECIES_CONFIG.other;
  const statusInfo = STATUS_LABELS[animal.status] || { label: animal.status, color: 'bg-gray-100' };
  const primaryBreed = animal.breeds?.find(b => b.primary)?.breed || animal.breeds?.[0]?.breed;
  const chip = animal.identifiers?.find(i => i.type === 'chip');
  const tattoo = animal.identifiers?.find(i => i.type === 'tattoo');

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{animal.name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                #{animal.public_code} · {animal.organization_name}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Photo */}
        <div className="aspect-square relative rounded-2xl overflow-hidden bg-muted shadow-lg">
          {animal.primary_photo_url ? (
            <Image
              src={animal.primary_photo_url}
              alt={animal.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-8xl">
              {species.emoji}
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Basic Info */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-sm py-1.5">
            {species.emoji} {species.label}
          </Badge>
          <Badge variant="outline" className="text-sm py-1.5">
            {SEX_LABELS[animal.sex] || animal.sex}
          </Badge>
          <Badge variant="outline" className="text-sm py-1.5">
            {AGE_GROUP_LABELS[animal.age_group] || animal.age_group}
          </Badge>
          {animal.size_estimated && animal.size_estimated !== 'unknown' && (
            <Badge variant="outline" className="text-sm py-1.5">
              {SIZE_LABELS[animal.size_estimated] || animal.size_estimated}
            </Badge>
          )}
        </div>

        {/* Special badges */}
        <div className="flex flex-wrap gap-2">
          {animal.is_special_needs && (
            <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium flex items-center gap-1">
              <Heart className="h-4 w-4" /> Speciální potřeby
            </span>
          )}
          {animal.is_dewormed && (
            <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
              <Shield className="h-4 w-4" /> Odčervený
            </span>
          )}
        </div>

        {/* Location */}
        {animal.current_kennel && (
          <Card>
            <CardContent className="p-4">
              <Link 
                href={`/public/kennels/${animal.current_kennel.id}`}
                className="flex items-center gap-3 hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium">{animal.current_kennel.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {animal.current_kennel.zone_name} · Kotec {animal.current_kennel.code}
                  </p>
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Description */}
        {animal.description && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">O {animal.name}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{animal.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Behavior */}
        {animal.behavior_notes && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">Povaha</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{animal.behavior_notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          {primaryBreed && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Plemeno</p>
                <p className="font-medium">{primaryBreed}</p>
              </CardContent>
            </Card>
          )}
          {animal.color && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Barva</p>
                <p className="font-medium">{animal.color}</p>
              </CardContent>
            </Card>
          )}
          {animal.coat && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Srst</p>
                <p className="font-medium">{animal.coat}</p>
              </CardContent>
            </Card>
          )}
          {animal.weight_current_kg && (
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <Weight className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Váha</p>
                  <p className="font-medium">{animal.weight_current_kg} kg</p>
                </div>
              </CardContent>
            </Card>
          )}
          {animal.bcs && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Kondice (BCS)</p>
                <p className="font-medium">{animal.bcs}/9</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Identifiers */}
        {(chip || tattoo) && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3">Identifikace</h2>
              <div className="space-y-2">
                {chip && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Čip</span>
                    <span className="font-mono text-sm">{chip.value}</span>
                  </div>
                )}
                {tattoo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tetování</span>
                    <span className="font-mono text-sm">{tattoo.value}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-8 text-sm text-muted-foreground space-y-2">
          <p>🏠 Máte zájem o {animal.name}?</p>
          <p>Kontaktujte nás - rádi vám povíme víc!</p>
        </div>
      </div>
    </div>
  );
}
