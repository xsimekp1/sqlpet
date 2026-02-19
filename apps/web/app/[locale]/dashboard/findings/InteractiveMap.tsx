'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ApiClient from '@/app/lib/api';
import { toast } from 'sonner';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface FindingWithGPS {
  id: string;
  animal_id: string | null;
  animal_name: string | null;
  animal_public_code: string | null;
  species: string | null;
  when_found: string | null;
  where_lat: number;
  where_lng: number;
  status: 'current' | 'past';
}

interface ShelterMapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface InteractiveMapProps {
  findings: FindingWithGPS[];
  organization?: {
    lat: number | null;
    lng: number | null;
    name: string | null;
  };
  gpsCenter: { lat: number; lng: number } | null;
  radius: number;
  onMapClick: (lat: number, lng: number) => void;
  showHeatMap?: boolean;
  showShelters?: boolean;
}

// Custom marker icons
const createCustomIcon = (color: string, emoji: string) => {
  return L.divIcon({
    html: `<div style="
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">${emoji}</div>`,
    className: 'custom-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

const dogIcon = createCustomIcon('#3b82f6', '🐕');
const catIcon = createCustomIcon('#f97316', '🐈');
const rabbitIcon = createCustomIcon('#8b5cf6', '🐰');
const birdIcon = createCustomIcon('#10b981', '🐦');
const otherIcon = createCustomIcon('#6b7280', '🐾');

const shelterIcon = L.divIcon({
  html: `<div style="
    background-color: #dc2626;
    border: 2px solid white;
    border-radius: 4px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  ">🏠</div>`,
  className: 'shelter-icon',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

const centerIcon = L.divIcon({
  html: `<div style="
    background-color: #6366f1;
    border: 3px solid white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  className: 'center-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function getIconForSpecies(species: string | null): L.DivIcon {
  if (!species) return otherIcon;
  const s = species.toLowerCase();
  if (s === 'dog') return dogIcon;
  if (s === 'cat') return catIcon;
  if (s === 'rabbit') return rabbitIcon;
  if (s === 'bird') return birdIcon;
  return otherIcon;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function InteractiveMap({
  findings,
  organization,
  gpsCenter,
  radius,
  onMapClick,
  showHeatMap = false,
  showShelters = true,
}: InteractiveMapProps) {
  const [shelters, setShelters] = useState<ShelterMapPoint[]>([]);
  const [loadingShelters, setLoadingShelters] = useState(false);

  // Load shelters for map
  useEffect(() => {
    if (showShelters) {
      loadShelters();
    }
  }, [showShelters]);

  const loadShelters = async () => {
    setLoadingShelters(true);
    try {
      const data = await ApiClient.getSheltersForMap();
      setShelters(data);
    } catch (error) {
      console.error('Failed to load shelters:', error);
      // Don't show error toast, just silently fail
    } finally {
      setLoadingShelters(false);
    }
  };

  // Determine map center and zoom
  let center: [number, number] = [49.8, 15.5]; // Czech Republic center
  let zoom = 8;

  if (gpsCenter) {
    center = [gpsCenter.lat, gpsCenter.lng];
    zoom = 11;
  } else if (findings.length > 0) {
    // Calculate bounds
    const lats = findings.map(f => f.where_lat);
    const lngs = findings.map(f => f.where_lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    center = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];

    // Calculate zoom based on span
    const span = Math.max(maxLat - minLat, maxLng - minLng);
    if (span < 0.1) zoom = 14;
    else if (span < 0.5) zoom = 12;
    else if (span < 2) zoom = 10;
    else zoom = 8;
  } else if (organization?.lat && organization?.lng) {
    center = [organization.lat, organization.lng];
    zoom = 10;
  }

  return (
    <div className="relative">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '500px', width: '100%', borderRadius: '0.5rem' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map click handler */}
        <MapClickHandler onMapClick={onMapClick} />

        {/* GPS filter center point and radius circle */}
        {gpsCenter && (
          <>
            <Marker position={[gpsCenter.lat, gpsCenter.lng]} icon={centerIcon}>
              <Popup>
                <div className="text-sm">
                  <strong>GPS filtr</strong>
                  <br />
                  {gpsCenter.lat.toFixed(4)}, {gpsCenter.lng.toFixed(4)}
                  <br />
                  Radius: {radius} km
                </div>
              </Popup>
            </Marker>
            <Circle
              center={[gpsCenter.lat, gpsCenter.lng]}
              radius={radius * 1000} // Convert km to meters
              pathOptions={{
                color: '#6366f1',
                fillColor: '#6366f1',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
          </>
        )}

        {/* Organization marker */}
        {organization?.lat && organization?.lng && (
          <Marker position={[organization.lat, organization.lng]} icon={shelterIcon}>
            <Popup>
              <div className="text-sm">
                <strong>🏠 Váš útulek</strong>
                <br />
                {organization.name}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Findings markers */}
        {findings.map((finding) => (
          <Marker
            key={finding.id}
            position={[finding.where_lat, finding.where_lng]}
            icon={getIconForSpecies(finding.species)}
          >
            <Popup>
              <div className="text-sm space-y-1">
                <div className="font-semibold">
                  {finding.animal_name || 'Neznámé zvíře'}
                </div>
                {finding.animal_public_code && (
                  <div className="text-xs text-gray-600">
                    Kód: {finding.animal_public_code}
                  </div>
                )}
                <div className="text-xs capitalize">
                  Druh: {finding.species || 'neznámý'}
                </div>
                {finding.when_found && (
                  <div className="text-xs">
                    Nalezeno: {new Date(finding.when_found).toLocaleDateString('cs-CZ')}
                  </div>
                )}
                <div className="text-xs">
                  Status: {finding.status === 'current' ? 'Aktuální' : 'Historický'}
                </div>
                {finding.animal_id && (
                  <a
                    href={`/dashboard/animals/${finding.animal_id}`}
                    className="text-xs text-blue-600 hover:underline block mt-1"
                  >
                    Zobrazit detail →
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Registered shelters */}
        {showShelters && shelters.map((shelter) => (
          <Marker
            key={shelter.id}
            position={[shelter.lat, shelter.lng]}
            icon={shelterIcon}
            opacity={0.6}
          >
            <Popup>
              <div className="text-sm">
                <strong>🏠 Registrovaný útulek</strong>
                <br />
                {shelter.name}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg border text-xs space-y-1 z-[1000]">
        <div className="font-semibold mb-2">Legenda</div>
        <div className="flex items-center gap-2">
          <span>🐕</span>
          <span>Pes</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🐈</span>
          <span>Kočka</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🐰</span>
          <span>Králík</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🐦</span>
          <span>Pták</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🐾</span>
          <span>Jiné</span>
        </div>
        <div className="border-t pt-1 mt-1">
          <div className="flex items-center gap-2">
            <span>🏠</span>
            <span>Útulek</span>
          </div>
        </div>
      </div>
    </div>
  );
}
