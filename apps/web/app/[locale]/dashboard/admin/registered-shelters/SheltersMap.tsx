'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ShelterWithGPS {
  id: string;
  registration_number: string;
  name: string;
  address: string;
  region: string;
  activity_type: string | null;
  capacity: string | null;
  lat: number;
  lng: number;
  registration_date: string | null;
  notes?: string | null;
}

interface SheltersMapProps {
  shelters: ShelterWithGPS[];
}

// Custom shelter icon
const shelterIcon = L.divIcon({
  html: `<div style="
    background-color: #dc2626;
    border: 2px solid white;
    border-radius: 4px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  ">🏠</div>`,
  className: 'shelter-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

export default function SheltersMap({ shelters }: SheltersMapProps) {
  // Determine map center and zoom
  let center: [number, number] = [49.8, 15.5]; // Czech Republic center
  let zoom = 7;

  if (shelters.length > 0) {
    // Calculate bounds
    const lats = shelters.map(s => s.lat);
    const lngs = shelters.map(s => s.lng);
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
    else if (span < 5) zoom = 9;
    else zoom = 7;
  }

  if (shelters.length === 0) {
    return (
      <div className="h-[500px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Žádné útulky s GPS souřadnicemi</p>
      </div>
    );
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

        {/* Shelter markers */}
        {shelters.map((shelter) => (
          <Marker
            key={shelter.id}
            position={[shelter.lat, shelter.lng]}
            icon={shelterIcon}
          >
            <Popup>
              <div className="text-sm space-y-1 min-w-[200px]">
                <div className="font-semibold text-base">{shelter.name}</div>
                <div className="text-xs font-mono text-gray-600">
                  {shelter.registration_number}
                </div>
                <div className="text-xs pt-1 border-t">
                  <strong>Adresa:</strong><br />
                  {shelter.address}
                </div>
                <div className="text-xs">
                  <strong>Kraj:</strong> {shelter.region}
                </div>
                {shelter.activity_type && (
                  <div className="text-xs">
                    <strong>Činnost:</strong> {shelter.activity_type}
                  </div>
                )}
                {shelter.capacity && (
                  <div className="text-xs">
                    <strong>Kapacita:</strong> {shelter.capacity}
                  </div>
                )}
                {shelter.registration_date && (
                  <div className="text-xs">
                    <strong>Registrován:</strong>{' '}
                    {new Date(shelter.registration_date).toLocaleDateString('cs-CZ')}
                  </div>
                )}
                {shelter.notes && (
                  <div className="text-xs pt-1 border-t">
                    <strong>Poznámky:</strong><br />
                    {shelter.notes}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg border text-sm z-[1000]">
        <div className="font-semibold mb-1">Statistiky</div>
        <div className="text-xs space-y-1">
          <div>Celkem útulků: <strong>{shelters.length}</strong></div>
          <div>
            Registrů:{' '}
            <strong>{new Set(shelters.map(s => s.region)).size}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
