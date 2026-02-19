'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Building2, Search, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import ApiClient from '@/app/lib/api';

interface RegisteredShelter {
  id: string;
  registration_number: string;
  name: string;
  address: string;
  region: string;
  activity_type: string | null;
  capacity: string | null;
  lat: number | null;
  lng: number | null;
  registration_date: string | null;
}

export default function RegisteredSheltersPage() {
  const t = useTranslations('admin');
  const [shelters, setShelters] = useState<RegisteredShelter[]>([]);
  const [regions, setRegions] = useState<{ region: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRegions();
  }, []);

  useEffect(() => {
    if (selectedRegion && selectedRegion !== 'all') {
      loadShelters(selectedRegion);
    } else {
      loadShelters();
    }
  }, [selectedRegion]);

  const loadRegions = async () => {
    try {
      const data = await ApiClient.getShelterRegions();
      setRegions(data);
    } catch (error) {
      console.error('Failed to load regions:', error);
    }
  };

  const loadShelters = async (region?: string) => {
    setLoading(true);
    try {
      const data = await ApiClient.getRegisteredShelters(region && region !== 'all' ? region : undefined);
      setShelters(data);
    } catch (error) {
      console.error('Failed to load shelters:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShelters = shelters.filter((shelter) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      shelter.name.toLowerCase().includes(query) ||
      shelter.registration_number.toLowerCase().includes(query) ||
      shelter.address.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registr útulků</h1>
          <p className="text-muted-foreground">
            Veterinární registrace útulků pro zvířata ({shelters.length} záznamů)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Hledat podle názvu, čísla, adresy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Všechny kraje" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny kraje</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r.region} value={r.region}>
                {r.region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{shelters.length}</div>
            <p className="text-sm text-muted-foreground">Celkem útulků</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{regions.length}</div>
            <p className="text-sm text-muted-foreground">Krajů</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {shelters.filter((s) => s.lat && s.lng).length}
            </div>
            <p className="text-sm text-muted-foreground">S GPS souřadnicemi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {shelters.filter((s) => s.capacity?.includes('pes')).length}
            </div>
            <p className="text-sm text-muted-foreground">Pro psy</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredShelters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Žádné útulky nenalezeny</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredShelters.map((shelter) => (
            <Card key={shelter.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{shelter.name}</h3>
                      <Badge variant="outline" className="font-mono text-xs">
                        {shelter.registration_number}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {shelter.address}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <Badge variant="secondary">{shelter.region}</Badge>
                      {shelter.activity_type && (
                        <span className="text-muted-foreground">{shelter.activity_type}</span>
                      )}
                      {shelter.registration_date && (
                        <span className="text-muted-foreground">
                          Registrován: {new Date(shelter.registration_date).toLocaleDateString('cs-CZ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {shelter.capacity && (
                      <p className="text-sm font-medium">{shelter.capacity}</p>
                    )}
                    {shelter.lat && shelter.lng ? (
                      <Badge className="mt-2 bg-green-500">GPS ✓</Badge>
                    ) : (
                      <Badge variant="outline" className="mt-2">Bez GPS</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
