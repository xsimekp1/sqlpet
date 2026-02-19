'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Search, MapPin, Clock, Dog, PawPrint, Map, List, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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

const SPECIES_COLORS: Record<string, string> = {
  dog: '#3b82f6',
  cat: '#f97316',
  rabbit: '#22c55e',
  bird: '#a855f7',
  other: '#6b7280',
};

function getSpeciesColor(species: string | null): string {
  if (!species) return SPECIES_COLORS.other;
  return SPECIES_COLORS[species.toLowerCase()] || SPECIES_COLORS.other;
}

// Load Leaflet from CDN
function useLeaflet() {
  const [leaflet, setLeaflet] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already loaded
    if ((window as any).L) {
      setLeaflet((window as any).L);
      setLoaded(true);
      return;
    }

    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setLeaflet((window as any).L);
      setLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      link.remove();
      script.remove();
    };
  }, []);

  return { leaflet, loaded };
}

export default function FindingsPage() {
  const t = useTranslations('findings');
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'both'>('both');
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

  const mapCenter: [number, number] = mapData?.organization?.lat && mapData?.organization?.lng
    ? [mapData.organization.lat, mapData.organization.lng]
    : filteredFindings[0]?.where_lat && filteredFindings[0]?.where_lng
    ? [filteredFindings[0].where_lat, filteredFindings[0].where_lng]
    : [50.0755, 14.4378];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
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
          <TabsTrigger value="both" className="gap-2">
            <Map className="h-4 w-4" />
            <List className="h-4 w-4" />
            Obě
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <FindingsList findings={filteredFindings} organization={mapData?.organization} />
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <FindingsMap 
            findings={filteredFindings} 
            organization={mapData?.organization}
            center={mapCenter}
          />
        </TabsContent>

        <TabsContent value="both" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FindingsList findings={filteredFindings} organization={mapData?.organization} />
            <FindingsMap 
              findings={filteredFindings} 
              organization={mapData?.organization}
              center={mapCenter}
            />
          </div>
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
          const speciesIcon = finding.species === 'dog' ? '🐕' : finding.species === 'cat' ? '🐈' : '🐾';
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
                <Badge 
                  variant={finding.status === 'current' ? 'default' : 'secondary'}
                  className="mt-2"
                >
                  {finding.status === 'current' ? 'Aktuální' : 'Historický'}
                </Badge>
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
  center,
}: { 
  findings: FindingMapData[];
  organization?: { lat: number | null; lng: number | null; name: string | null };
  center: [number, number];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const { leaflet, loaded } = useLeaflet();

  useEffect(() => {
    if (!loaded || !leaflet || !mapRef.current || mapInstanceRef.current) return;

    // Create map
    const map = leaflet.map(mapRef.current).setView(center, 13);

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    // Add organization marker (red house)
    if (organization?.lat && organization?.lng) {
      const orgIcon = leaflet.divIcon({
        className: 'custom-marker',
        html: `<div style="background:#ef4444;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;">🏠</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      
      leaflet.marker([organization.lat, organization.lng], { icon: orgIcon })
        .addTo(map)
        .bindPopup(`<b>${organization.name || 'Útulek'}</b><br>Vaše organizace`);
    }

    // Add finding markers
    findings.forEach((finding) => {
      if (!finding.where_lat || !finding.where_lng) return;
      
      const color = getSpeciesColor(finding.species);
      const speciesIcon = finding.species === 'dog' ? '🐕' : finding.species === 'cat' ? '🐈' : '🐾';
      
      const icon = leaflet.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${speciesIcon}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = leaflet.marker([finding.where_lat, finding.where_lng], { icon })
        .addTo(map);

      const popupContent = `
        <div style="min-width:150px;">
          <b style="font-size:14px;">${speciesIcon} ${finding.animal_name || 'Neznámé zvíře'}</b>
          ${finding.animal_public_code ? `<br><span style="color:#666;font-size:12px;">${finding.animal_public_code}</span>` : ''}
          ${finding.when_found ? `<br><span style="font-size:12px;">Nalezeno: ${new Date(finding.when_found).toLocaleDateString('cs-CZ')}</span>` : ''}
          <br><span style="font-size:11px;padding:2px 6px;background:${finding.status === 'current' ? '#3b82f6' : '#6b7280'};color:white;border-radius:4px;">${finding.status === 'current' ? 'Aktuální' : 'Historický'}</span>
          ${finding.animal_id ? `<br><a href="/dashboard/animals/${finding.animal_id}" style="color:#3b82f6;font-size:12px;">Zobrazit detail →</a>` : ''}
        </div>
      `;
      
      marker.bindPopup(popupContent);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [loaded, leaflet, findings, organization, center]);

  if (!loaded) {
    return (
      <Card>
        <CardContent className="p-0">
          <Skeleton className="h-[500px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div ref={mapRef} className="h-[500px] rounded-lg" />
        
        {/* Legend */}
        <div className="p-3 border-t flex gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-red-500">🏠</span>
            <span>Útulek</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-blue-500">🐕</span>
            <span>Pes</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-orange-500">🐈</span>
            <span>Kočka</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-500">🐾</span>
            <span>Jiné</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
