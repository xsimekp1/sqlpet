'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  MapPin, Clock, ExternalLink, List, Map as MapIcon,
  Search, X, Loader2, Calendar, Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import ApiClient from '@/app/lib/api';
import { toast } from 'sonner';

// Dynamic import for Leaflet to avoid SSR issues
const InteractiveMap = dynamic(() => import('./InteractiveMap'), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-muted animate-pulse rounded-lg" />
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
  { value: 'all', label: 'Všechny záznamy' },
  { value: 'today', label: 'Dnes' },
  { value: 'week', label: 'Tento týden' },
  { value: 'month', label: 'Tento měsíc' },
  { value: 'year', label: 'Tento rok' },
];

const RADIUS_OPTIONS = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
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
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [showShelters, setShowShelters] = useState(true);

  useEffect(() => {
    loadMapData();
  }, []);

  // Contact search debounce
  useEffect(() => {
    if (!contactSearch || contactSearch.length < 2) {
      setContacts([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingContacts(true);
      try {
        const result = await ApiClient.searchContacts(contactSearch);
        setContacts(result);
      } catch {
        setContacts([]);
      } finally {
        setSearchingContacts(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [contactSearch]);

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
      // Use Nominatim API (free OpenStreetMap geocoding)
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
    setLocationQuery(''); // Clear search query
  };

  const clearGpsFilter = () => {
    setGpsLat(null);
    setGpsLng(null);
    setLocationQuery('');
  };

  const clearContactFilter = () => {
    setSelectedContact(null);
    setContactSearch('');
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
    // Status filter
    if (selectedStatus !== 'all' && f.status !== selectedStatus) return false;

    // Species filter
    if (f.species && !selectedSpecies.has(f.species.toLowerCase())) return false;

    // Date filter
    if (dateFrom && f.when_found && f.when_found < dateFrom) return false;
    if (dateTo && f.when_found && f.when_found > dateTo) return false;

    // GPS radius filter
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
      case 'year': {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return { from: yearAgo.toISOString().split('T')[0], to: today };
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
                     gpsLat !== null ||
                     selectedContact;

  const clearAllFilters = () => {
    setSelectedStatus('all');
    setSelectedSpecies(new Set(SPECIES));
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    clearGpsFilter();
    clearContactFilter();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-96 w-full" />
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
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Species toggles */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Druh zvířete</Label>
            <div className="flex flex-wrap gap-2">
              {SPECIES.map(species => (
                <Button
                  key={species}
                  variant={selectedSpecies.has(species) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleSpecies(species)}
                >
                  <span className="mr-1">{SPECIES_ICONS[species]}</span>
                  {SPECIES_LABELS[species]}
                </Button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Období</Label>
              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {datePreset === 'all' && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm">Od</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Do</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* GPS + Geocoding */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Vyhledat místo (geocoding)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Zadejte obec nebo adresu..."
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGeocodeSearch()}
                />
                <Button
                  onClick={handleGeocodeSearch}
                  disabled={geocoding || !locationQuery.trim()}
                  size="icon"
                >
                  {geocoding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">GPS filtr (klikněte na mapu)</Label>
              <div className="flex gap-2 items-center">
                {gpsLat !== null && gpsLng !== null ? (
                  <>
                    <div className="flex-1 flex items-center gap-2 bg-primary/10 px-3 py-2 rounded">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">
                        {gpsLat.toFixed(4)}, {gpsLng.toFixed(4)}
                      </span>
                    </div>
                    <Select
                      value={radius.toString()}
                      onValueChange={(v) => setRadius(parseInt(v))}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RADIUS_OPTIONS.map(r => (
                          <SelectItem key={r.value} value={r.value.toString()}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={clearGpsFilter} size="icon" variant="ghost">
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground py-2">
                    Klikněte na mapu pro nastavení GPS filtru
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status filter */}
          <div className="space-y-2">
            <Label className="text-sm">Status</Label>
            <div className="flex gap-2">
              <Button
                variant={selectedStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('all')}
              >
                Vše
              </Button>
              <Button
                variant={selectedStatus === 'current' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('current')}
              >
                Aktuální
              </Button>
              <Button
                variant={selectedStatus === 'past' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('past')}
              >
                Historie
              </Button>
            </div>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Vymazat všechny filtry
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredFindings.length}</div>
            <p className="text-sm text-muted-foreground">Celkem nálezů</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{findingsWithLocation.length}</div>
            <p className="text-sm text-muted-foreground">S GPS</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {filteredFindings.filter(f => f.status === 'current').length}
            </div>
            <p className="text-sm text-muted-foreground">Aktuálních</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{statsBySpecies.dog}</div>
            <p className="text-sm text-muted-foreground">🐕 Psi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{statsBySpecies.cat}</div>
            <p className="text-sm text-muted-foreground">🐈 Kočky</p>
          </CardContent>
        </Card>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapIcon className="h-5 w-5" />
                  Interaktivní mapa nálezů
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={showHeatMap ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowHeatMap(!showHeatMap)}
                  >
                    Heat Map
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
            <CardContent>
              <InteractiveMap
                findings={findingsWithLocation}
                organization={mapData?.organization}
                gpsCenter={gpsLat && gpsLng ? { lat: gpsLat, lng: gpsLng } : null}
                radius={radius}
                onMapClick={handleMapClick}
                showHeatMap={showHeatMap}
                showShelters={showShelters}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Nálezů: {findings.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
                        {distance} od útulku
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
                      Otevřít v mapě
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
