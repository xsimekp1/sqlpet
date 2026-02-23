export interface KennelAnimal {
  id: string;
  name: string;
  species: string;
  public_code: string | null;
  photo_url: string | null;
  start_at: string | null;
}

export type KennelStatus = 'available' | 'maintenance' | 'quarantine' | 'reserved';

export interface Kennel {
  id: string;
  code: string;
  name: string;
  zone_id: string | null;
  zone_name: string | null;
  status: KennelStatus;
  type: string | null;
  size_category: string | null;
  capacity: number;
  occupied_count: number;
  animals_preview: KennelAnimal[];
  alerts: string[];
  last_cleaned_at: string | null;
  maintenance_start_at: string | null;
  maintenance_end_at: string | null;
  maintenance_reason: string | null;
  notes: string | null;
}

