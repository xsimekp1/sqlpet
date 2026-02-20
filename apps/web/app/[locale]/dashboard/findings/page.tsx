'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  MapPin, Clock, ExternalLink, List, Map as MapIcon,
  Search, X, Loader2, Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import ApiClient from '@/app/lib/api';
import { toast } from 'sonner';

// Dynamic import for Leaflet to avoid SSR issues
const InteractiveMap = dynamic(() => import('./InteractiveMap'), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
});

interface FindingMapData {
  id: string;
  animal_id: string | null;
  animal_name: string | null;
  animal_public_code: string | null;
  species: string | null;
  when_found: string | null;
  where_lat: number | null;
  where_lng: number | null;
  status: 'current' | 'past';
}

interface FindingsMapResponse {
  organization: {
    lat: number | null;
    lng: number | null;
    name: string | null;
  };
  findings: FindingMapData[];
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
}

const SPECIES = ['dog', 'cat', 'rabbit', 'bird', 'other'];
const SPECIES_ICONS: Record<string, string> = {
  dog: '🐕',
  cat: '🐈',
  rabbit: '🐰',
  bird: '🐦',
  other: '🐾',
};

const SPECIES_LABELS: Record<string, string> = {
  dog: 'Pes',
  cat: 'Kočka',
  rabbit: 'Králík',
  bird: 'Pták',
  other: 'Jiné',
};

const DATE_PRESETS = [
  { value: 'all', label: 'Všechny' },
  { value: 'today', label: 'Dnes' },
  { value: 'week', label: 'Týden' },
  { value: 'month', label: 'Měsíc' },
];

function getSpeciesIcon(species: string | null): string {
  if (!species) return SPECIES_ICONS.other;
  return SPECIES_ICONS[species.toLowerCase()] || SPECIES_ICONS.other;
}

export default function FindingsPage() {
  const t = useTranslations('findings');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [loading, setLoading] = useState(true);
  const [mapData, setMapData] = useState<FindingsMapResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'current' | 'past'>('all');
  const [selectedSpecies, setSelectedSpecies] = useState<Set<string>>(new Set(SPECIES));
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(25);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [showShelters, setShowShelters] = useState(false);

  useEffect(() => {
    loadMapData();
  }, []);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const data = await ApiClient.getFindingsMapData();
      setMapData(data);
    } catch (error) {
      console.error('Failed to load findings map data:', error);
      toast.error('Nepodařilo se načíst data nálezů');
    } finally {
      setLoading(false);
    }
  };

  const handleGeocodeSearch = async () => {
    if (!locationQuery.trim()) return;

    setGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&countrycodes=cz&limit=1`,
        {
          headers: {
            'User-Agent': 'PawShelter/1.0'
          }
        }
      );
      const results = await response.json();

      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        setGpsLat(lat);
        setGpsLng(lng);
        toast.success(`Nalezena poloha: ${results[0].display_name}`);
      } else {
        toast.error('Místo nenalezeno');
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
      toast.error('Nepodařilo se vyhledat místo');
    } finally {
      setGeocoding(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setGpsLat(lat);
    setGpsLng(lng);
    setLocationQuery('');
  };

  const clearGpsFilter = () => {
    setGpsLat(null);
    setGpsLng(null);
    setLocationQuery('');
  };

  const toggleSpecies = (species: string) => {
    const newSet = new Set(selectedSpecies);
    if (newSet.has(species)) {
      newSet.delete(species);
    } else {
      newSet.add(species);
    }
    setSelectedSpecies(newSet);
  };

  const filteredFindings = mapData?.findings.filter((f) => {
    if (selectedStatus !== 'all' && f.status !== selectedStatus) return false;
    if (f.species && !selectedSpecies.has(f.species.toLowerCase())) return false;
    if (dateFrom && f.when_found && f.when_found < dateFrom) return false;
    if (dateTo && f.when_found && f.when_found > dateTo) return false;

    if (gpsLat !== null && gpsLng !== null && f.where_lat && f.where_lng) {
      const distance = calculateDistance(gpsLat, gpsLng, f.where_lat, f.where_lng);
      if (distance > radius) return false;
    }

    return true;
  }) || [];

  const findingsWithLocation = filteredFindings.filter(
    (f): f is FindingMapData & { where_lat: number; where_lng: number } =>
      f.where_lat !== null && f.where_lng !== null
  );

  const getDateRange = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (datePreset) {
      case 'today':
        return { from: today, to: today };
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { from: weekAgo.toISOString().split('T')[0], to: today };
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { from: monthAgo.toISOString().split('T')[0], to: today };
      }
      default:
        return { from: dateFrom || '', to: dateTo || '' };
    }
  };

  useEffect(() => {
    const range = getDateRange();
    setDateFrom(range.from);
    setDateTo(range.to);
  }, [datePreset]);

  const hasFilters = selectedStatus !== 'all' ||
                     selectedSpecies.size !== SPECIES.length ||
                     datePreset !== 'all' ||
                     dateFrom ||
                     dateTo ||
                     gpsLat !== null;

  const clearAllFilters = () => {
    setSelectedStatus('all');
    setSelectedSpecies(new Set(SPECIES));
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    clearGpsFilter();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  // Stats
  const statsBySpecies = SPECIES.reduce((acc, species) => {
    acc[species] = filteredFindings.filter(f =>
      f.species?.toLowerCase() === species
    ).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {/* View toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="map" className="gap-2">
            <MapIcon className="h-4 w-4" />
            Mapa
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Seznam
          </TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Map - left side, capped at 900px */}
            <div className="lg:w-[60%] lg:max-w-[900px] lg:min-h-[500px]">
              <Card className="h-full min-h-[400px]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Mapa</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant={showHeatMap ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowHeatMap(!showHeatMap)}
                      >
                        Heat
                      </Button>
                      <Button
                        variant={showShelters ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowShelters(!showShelters)}
                      >
                        Útulky
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-2 h-[calc(100%-60px)]">
                  <div className="w-full h-full">
                    <InteractiveMap
                      findings={findingsWithLocation}
                      organization={mapData?.organization}
                      gpsCenter={gpsLat && gpsLng ? { lat: gpsLat, lng: gpsLng } : null}
                      radius={radius}
                      onMapClick={handleMapClick}
                      showHeatMap={showHeatMap}
                      showShelters={showShelters}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Sidebar - right side */}
            <div className="lg:flex-1 flex flex-col gap-4">
              {/* Filters - collapsible */}
              <Card>
                <CardHeader className="pb-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-between font-semibold"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <span className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Filtry
                      {hasFilters && (
                        <Badge variant="secondary" className="ml-1">
                          {hasFilters ? 'Aktivní' : ''}
                        </Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {showFilters ? 'Skrýt' : 'Zobrazit'}
                    </span>
                  </Button>
                </CardHeader>
                {showFilters && (
                  <CardContent className="space-y-3 pt-0">
                    {/* Species */}
                    <div className="flex flex-wrap gap-1">
                      {SPECIES.map(species => (
                        <Button
                          key={species}
                          variant={selectedSpecies.has(species) ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => toggleSpecies(species)}
                        >
                          <span className="mr-1">{SPECIES_ICONS[species]}</span>
                        </Button>
                      ))}
                    </div>

                    {/* Date */}
                    <Select value={datePreset} onValueChange={setDatePreset}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_PRESETS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Status */}
                    <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Vše</SelectItem>
                        <SelectItem value="current">Aktuální</SelectItem>
                        <SelectItem value="past">Historie</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Location */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Hledat místo..."
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGeocodeSearch()}
                        className="h-8"
                      />
                      <Button
                        onClick={handleGeocodeSearch}
                        disabled={geocoding || !locationQuery.trim()}
                        size="icon"
                        className="h-8 w-8"
                      >
                        {geocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                      </Button>
                    </div>

                    {gpsLat !== null && gpsLng !== null && (
                      <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded text-xs">
                        <MapPin className="h-3 w-3" />
                        <span>{gpsLat.toFixed(2)}, {gpsLng.toFixed(2)}</span>
                        <Button onClick={clearGpsFilter} size="icon" variant="ghost" className="h-4 w-4 ml-auto">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {hasFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        onClick={clearAllFilters}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Vymazat filtry
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="py-2">
                  <CardContent className="pt-2 text-center">
                    <div className="text-xl font-bold">{filteredFindings.length}</div>
                    <p className="text-xs text-muted-foreground">Celkem</p>
                  </CardContent>
                </Card>
                <Card className="py-2">
                  <CardContent className="pt-2 text-center">
                    <div className="text-xl font-bold">{findingsWithLocation.length}</div>
                    <p className="text-xs text-muted-foreground">S GPS</p>
                  </CardContent>
                </Card>
                <Card className="py-2">
                  <CardContent className="pt-2 text-center">
                    <div className="text-xl font-bold">
                      {filteredFindings.filter(f => f.status === 'current').length}
                    </div>
                    <p className="text-xs text-muted-foreground">Aktuální</p>
                  </CardContent>
                </Card>
              </div>

              {/* List */}
              <FindingsList
                findings={filteredFindings}
                organization={mapData?.organization}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          {/* Compact filters for list view */}
          <Card className="mb-4">
            <CardContent className="p-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {SPECIES.map(species => (
                  <Button
                    key={species}
                    variant={selectedSpecies.has(species) ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => toggleSpecies(species)}
                  >
                    <span className="mr-1">{SPECIES_ICONS[species]}</span>
                    {SPECIES_LABELS[species]}
                  </Button>
                ))}
              </div>

              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger className="h-7 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
                <SelectTrigger className="h-7 w-28">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vše</SelectItem>
                  <SelectItem value="current">Aktuální</SelectItem>
                  <SelectItem value="past">Historie</SelectItem>
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={clearAllFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  Vymazat
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-4">
            <Card className="py-2">
              <CardContent className="pt-2">
                <div className="text-lg font-bold">{filteredFindings.length}</div>
                <p className="text-xs text-muted-foreground">Celkem</p>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="pt-2">
                <div className="text-lg font-bold">{findingsWithLocation.length}</div>
                <p className="text-xs text-muted-foreground">S GPS</p>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="pt-2">
                <div className="text-lg font-bold">
                  {filteredFindings.filter(f => f.status === 'current').length}
                </div>
                <p className="text-xs text-muted-foreground">Aktuální</p>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="pt-2">
                <div className="text-lg font-bold">{statsBySpecies.dog}</div>
                <p className="text-xs text-muted-foreground">🐕</p>
              </CardContent>
            </Card>
            <Card className="py-2">
              <CardContent className="pt-2">
                <div className="text-lg font-bold">{statsBySpecies.cat}</div>
                <p className="text-xs text-muted-foreground">🐈</p>
              </CardContent>
            </Card>
          </div>

          <FindingsList
            findings={filteredFindings}
            organization={mapData?.organization}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FindingsList({
  findings,
  organization
}: {
  findings: FindingMapData[];
  organization?: { lat: number | null; lng: number | null; name: string | null };
}) {
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;

    if (d < 1) {
      return `${Math.round(d * 1000)} m`;
    }
    return `${d.toFixed(1)} km`;
  }

  if (findings.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Žádné nálezy odpovídající filtrům</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1 overflow-hidden flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          Nálezů: {findings.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3 p-3 pt-0">
        {findings.map((finding) => {
          const speciesIcon = getSpeciesIcon(finding.species);
          const distance = organization?.lat && organization?.lng && finding.where_lat && finding.where_lng
            ? calculateDistance(organization.lat, organization.lng, finding.where_lat, finding.where_lng)
            : null;

          return (
            <Link
              key={finding.id}
              href={finding.animal_id ? `/dashboard/animals/${finding.animal_id}` : '#'}
              className="block"
            >
              <div className="p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{speciesIcon}</span>
                    <div>
                      <p className="font-medium">
                        {finding.animal_name || 'Neznámé zvíře'}
                        {finding.animal_public_code && ` (${finding.animal_public_code})`}
                      </p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {finding.species || 'neznámý druh'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {finding.when_found && (
                      <p className="text-sm text-muted-foreground">
                        {new Date(finding.when_found).toLocaleDateString('cs-CZ')}
                      </p>
                    )}
                    {distance && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {distance}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant={finding.status === 'current' ? 'default' : 'secondary'}
                  >
                    {finding.status === 'current' ? 'Aktuální' : 'Historický'}
                  </Badge>
                  {finding.where_lat && finding.where_lng && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${finding.where_lat}&mlon=${finding.where_lng}&zoom=15`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="h-3 w-3" />
                      <ExternalLink className="h-2 w-2" />
                    </a>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
