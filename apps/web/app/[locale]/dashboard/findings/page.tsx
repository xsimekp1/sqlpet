'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Search, MapPin, Clock, Dog, PawPrint, Map, List, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import ApiClient from '@/app/lib/api';
import dynamic from 'next/dynamic';

// Dynamically import map to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-lg" /> }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

// Fix for Leaflet default icon
if (typeof window !== 'undefined') {
  import('leaflet').then((L) => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  });
}

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
  dog: '#3b82f6',    // blue
  cat: '#f97316',    // orange
  rabbit: '#22c55e', // green
  bird: '#a855f7',   // purple
  other: '#6b7280',  // gray
};

function getSpeciesColor(species: string | null): string {
  if (!species) return SPECIES_COLORS.other;
  return SPECIES_COLORS[species.toLowerCase()] || SPECIES_COLORS.other;
}

function createCustomIcon(color: string, isOrganization: boolean = false) {
  if (typeof window === 'undefined') return undefined;
  
  return import('leaflet').then((L) => {
    const svgIcon = isOrganization
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="24" height="24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
    
    return L.divIcon({
      className: 'custom-marker',
      html: svgIcon,
      iconSize: isOrganization ? [32, 32] : [24, 24],
      iconAnchor: isOrganization ? [16, 32] : [12, 24],
      popupAnchor: [0, -24],
    });
  });
}

export default function FindingsPage() {
  const t = useTranslations('findings');
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'both'>('both');
  const [loading, setLoading] = useState(true);
  const [mapData, setMapData] = useState<FindingsMapResponse | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'current' | 'past'>('all');
  
  // Custom icons state
  const [organizationIcon, setOrganizationIcon] = useState<any>(null);
  const [animalIcons, setAnimalIcons] = useState<Record<string, any>>({});

  useEffect(() => {
    loadMapData();
  }, []);

  useEffect(() => {
    // Create custom icons after component mounts
    if (typeof window !== 'undefined') {
      createCustomIcon('#ef4444', true).then(setOrganizationIcon); // red for organization
      
      Object.keys(SPECIES_COLORS).forEach((species) => {
        createCustomIcon(SPECIES_COLORS[species], false).then((icon) => {
          setAnimalIcons((prev) => ({ ...prev, [species]: icon }));
        });
      });
    }
  }, [mapData]);

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

  // Calculate center from organization or first finding
  const mapCenter: [number, number] = mapData?.organization?.lat && mapData?.organization?.lng
    ? [mapData.organization.lat, mapData.organization.lng]
    : filteredFindings[0]?.where_lat && filteredFindings[0]?.where_lng
    ? [filteredFindings[0].where_lat, filteredFindings[0].where_lng]
    : [50.0755, 14.4378]; // Default: Prague

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
            organizationIcon={organizationIcon}
            animalIcons={animalIcons}
          />
        </TabsContent>

        <TabsContent value="both" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FindingsList findings={filteredFindings} organization={mapData?.organization} />
            <FindingsMap 
              findings={filteredFindings} 
              organization={mapData?.organization}
              center={mapCenter}
              organizationIcon={organizationIcon}
              animalIcons={animalIcons}
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
  const t = useTranslations('findings');

  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const R = 6371; // Earth's radius in km
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
  organizationIcon,
  animalIcons 
}: { 
  findings: FindingMapData[];
  organization?: { lat: number | null; lng: number | null; name: string | null };
  center: [number, number];
  organizationIcon: any;
  animalIcons: Record<string, any>;
}) {
  const t = useTranslations('findings');

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

  // Only render map on client side
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
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
        <div className="h-[500px] rounded-lg overflow-hidden">
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Organization marker */}
            {organization?.lat && organization?.lng && (
              <Marker 
                position={[organization.lat, organization.lng]}
                icon={organizationIcon}
              >
                <Popup>
                  <div className="text-center">
                    <p className="font-semibold">{organization.name || 'Útulek'}</p>
                    <p className="text-sm text-muted-foreground">Vaše organizace</p>
                  </div>
                </Popup>
              </Marker>
            )}
            
            {/* Finding markers */}
            {findings.map((finding) => {
              if (!finding.where_lat || !finding.where_lng) return null;
              
              const icon = animalIcons[finding.species?.toLowerCase() || 'other'];
              const speciesIcon = finding.species === 'dog' ? '🐕' : finding.species === 'cat' ? '🐈' : '🐾';
              
              return (
                <Marker
                  key={finding.id}
                  position={[finding.where_lat, finding.where_lng]}
                  icon={icon}
                >
                  <Popup>
                    <div className="min-w-[150px]">
                      <p className="font-semibold flex items-center gap-2">
                        <span>{speciesIcon}</span>
                        {finding.animal_name || 'Neznámé zvíře'}
                      </p>
                      {finding.animal_public_code && (
                        <p className="text-sm text-muted-foreground">
                          {finding.animal_public_code}
                        </p>
                      )}
                      {finding.when_found && (
                        <p className="text-sm">
                          Nalezeno: {new Date(finding.when_found).toLocaleDateString('cs-CZ')}
                        </p>
                      )}
                      <Badge 
                        variant={finding.status === 'current' ? 'default' : 'secondary'}
                        className="mt-2"
                      >
                        {finding.status === 'current' ? 'Aktuální' : 'Historický'}
                      </Badge>
                      {finding.animal_id && (
                        <Link 
                          href={`/dashboard/animals/${finding.animal_id}`}
                          className="block mt-2 text-sm text-blue-600 hover:underline"
                        >
                          Zobrazit detail →
                        </Link>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
        
        {/* Legend */}
        <div className="p-3 border-t flex gap-4 text-sm">
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
