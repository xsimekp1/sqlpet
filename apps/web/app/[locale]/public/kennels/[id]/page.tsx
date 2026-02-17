'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Loader2, MapPin, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PublicKennelAnimal {
  id: string;
  name: string;
  species: string;
  public_code: string;
  photo_url: string | null;
  status: string;
}

interface PublicKennel {
  id: string;
  code: string;
  name: string;
  type: string;
  size_category: string;
  capacity: number;
  zone_name: string;
  occupied_count: number;
  animals: PublicKennelAnimal[];
}

const SPECIES_CONFIG: Record<string, { emoji: string; label: string }> = {
  dog: { emoji: '🐕', label: 'Pes' },
  cat: { emoji: '🐈', label: 'Kočka' },
  bird: { emoji: '🐦', label: 'Pták' },
  rabbit: { emoji: '🐇', label: 'Králík' },
  other: { emoji: '🐾', label: 'Jiné' },
};

const TYPE_LABELS: Record<string, string> = {
  indoor: 'Vnitřní',
  outdoor: 'Venkovní',
  isolation: 'Izolace',
  quarantine: 'Karanténa',
};

export default function PublicKennelPage() {
  const params = useParams();
  const kennelId = params.id as string;
  const [kennel, setKennel] = useState<PublicKennel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchKennel = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/kennels/${kennelId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Kotec nebyl nalezen');
          } else {
            setError('Chyba při načítání');
          }
          return;
        }
        const data = await res.json();
        setKennel(data);
      } catch (e) {
        setError('Chyba při načítání');
      } finally {
        setLoading(false);
      }
    };
    fetchKennel();
  }, [kennelId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !kennel) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Home className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">{error || 'Kotec nenalezen'}</h1>
            <p className="text-muted-foreground mb-4">Tento kotec bohužel neexistuje nebo je nedostupný.</p>
            <Link href="/">
              <Button>Zpět na úvod</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{kennel.name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {kennel.zone_name} · {kennel.code}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Kennel Info */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-sm">
            {TYPE_LABELS[kennel.type] || kennel.type}
          </Badge>
          <Badge variant="outline" className="text-sm">
            Kapacita: {kennel.capacity}
          </Badge>
          <Badge variant="outline" className="text-sm">
            Obsazeno: {kennel.occupied_count}
          </Badge>
        </div>

        {/* Animals */}
        {kennel.animals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Tento kotec je prázdný</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {kennel.animals.map((animal) => {
              const species = SPECIES_CONFIG[animal.species] || SPECIES_CONFIG.other;
              return (
                <Link key={animal.id} href={`/public/animals/${animal.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                    <div className="aspect-square relative bg-muted">
                      {animal.photo_url ? (
                        <Image
                          src={animal.photo_url}
                          alt={animal.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-6xl">
                          {species.emoji}
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-white/90 text-foreground">
                          #{animal.public_code}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="text-lg font-bold group-hover:text-primary transition-colors">
                        {animal.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {species.emoji} {species.label}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>Vítejte na návštěvě v našem útulku!</p>
          <p className="mt-1">Máte zájem o adopci? Ozvěte se nám.</p>
        </div>
      </div>
    </div>
  );
}
