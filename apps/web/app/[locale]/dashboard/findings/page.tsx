'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { MapPin, Clock, Home, ExternalLink, List, Map } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import ApiClient from '@/app/lib/api';

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

const SPECIES_ICONS: Record<string, string> = {
  dog: '🐕',
  cat: '🐈',
  rabbit: '🐰',
  bird: '🐦',
  other: '🐾',
};

function getSpeciesIcon(species: string | null): string {
  if (!species) return SPECIES_ICONS.other;
  return SPECIES_ICONS[species.toLowerCase()] || SPECIES_ICONS.other;
}

export default function FindingsPage() {
  const t = useTranslations('findings');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [loading, setLoading] = useState(true);
  const [mapData, setMapData] = useState<FindingsMapResponse | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'current' | 'past'>('all');

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
    } finally {
      setLoading(false);
    }
  };

  const filteredFindings = mapData?.findings.filter((f) => {
    if (selectedStatus === 'all') return true;
    return f.status === selectedStatus;
  }) || [];

  const findingsWithLocation = filteredFindings.filter(f => f.where_lat && f.where_lng);

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
        
        {/* Status filter */}
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredFindings.length}</div>
            <p className="text-sm text-muted-foreground">Celkem nálezů</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{findingsWithLocation.length}</div>
            <p className="text-sm text-muted-foreground">S GPS souřadnicemi</p>
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
      </div>

      {/* View toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Seznam
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2">
            <Map className="h-4 w-4" />
            Mapa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <FindingsList findings={filteredFindings} organization={mapData?.organization} />
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <FindingsMap 
            findings={findingsWithLocation} 
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
          <p className="text-muted-foreground">Žádné nálezy s GPS souřadnicemi</p>
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

function FindingsMap({ 
  findings, 
  organization,
}: { 
  findings: FindingMapData[];
  organization?: { lat: number | null; lng: number | null; name: string | null };
}) {
  // Build OpenStreetMap static URL
  const bounds = findings.length > 0 
    ? findings.map(f => [f.where_lat!, f.where_lng!] as [number, number])
    : organization?.lat && organization?.lng 
      ? [[organization.lat, organization.lng] as [number, number]]
      : [[50.0755, 14.4378] as [number, number]];
  
  const minLat = Math.min(...bounds.map(b => b[0]));
  const maxLat = Math.max(...bounds.map(b => b[0]));
  const minLng = Math.min(...bounds.map(b => b[1]));
  const maxLng = Math.max(...bounds.map(b => b[1]));
  
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const span = Math.max(maxLat - minLat, maxLng - minLng) * 1.2;
  const zoom = span > 0.5 ? 10 : span > 0.1 ? 12 : 14;

  // Build markers for map
  const markersParam = findings
    .filter(f => f.where_lat && f.where_lng)
    .map(f => {
      const icon = f.species === 'dog' ? 'marker-blue' : f.species === 'cat' ? 'marker-orange' : 'marker';
      return `${icon}|${f.where_lat},${f.where_lng}|${f.animal_name || 'Neznámé zvíře'}`;
    })
    .join('&markers=');

  const mapUrl = markersParam 
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - span}%2C${centerLat - span}%2C${centerLng + span}%2C${centerLat + span}&layer=mapnik&marker=${markersParam}`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - span}%2C${centerLat - span}%2C${centerLng + span}%2C${centerLat + span}&layer=mapnik`;

  if (findings.length === 0 && !organization?.lat) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Žádné GPS souřadnice k zobrazení</p>
          <p className="text-sm text-muted-foreground mt-2">
            Vyplňte GPS souřadnice organizace v nastavení
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Map className="h-5 w-5" />
          Interaktivní mapa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg overflow-hidden border">
          <iframe
            width="100%"
            height="450"
            style={{ border: 0 }}
            src={mapUrl}
            allowFullScreen
            loading="lazy"
            title="Mapa nálezů"
          />
        </div>
        
        {/* Quick links */}
        <div className="flex flex-wrap gap-2">
          {organization?.lat && organization?.lng && (
            <a 
              href={`https://www.openstreetmap.org/?mlat=${organization.lat}&mlon=${organization.lng}&zoom=15`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors text-sm font-medium"
            >
              <Home className="h-4 w-4" />
              Váš útulek
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <a 
            href={`https://www.openstreetmap.org/?mlat=${centerLat}&mlon=${centerLng}&zoom=${zoom}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors text-sm font-medium"
          >
            <MapPin className="h-4 w-4" />
            Otevřít v OpenStreetMap
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>🐕</span>
            <span>Pes</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🐈</span>
            <span>Kočka</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🐾</span>
            <span>Jiné</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
