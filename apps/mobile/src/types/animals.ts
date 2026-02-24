export type AnimalStatus =
  | 'registered'
  | 'intake'
  | 'available'
  | 'reserved'
  | 'adopted'
  | 'fostered'
  | 'returned'
  | 'deceased'
  | 'transferred'
  | 'hold'
  | 'quarantine'
  | 'returned_to_owner'
  | 'euthanized'
  | 'escaped'
  | 'hotel'
  | 'with_owner';

export type AnimalSpecies = 'dog' | 'cat' | 'rodent' | 'bird' | 'other';
export type AnimalSex = 'male' | 'female' | 'unknown';

export interface AnimalBreed {
  breed_id: string;
  breed_name: string;
  breed_species: string;
  percent: number | null;
  display_name?: string | null;
}

export interface AnimalIdentifier {
  id: string;
  type: string; // 'microchip', 'tattoo', 'ear_tag', etc.
  value: string;
  notes: string | null;
  created_at: string | null;
}

export interface AnimalListItem {
  id: string;
  name: string;
  species: AnimalSpecies;
  sex: AnimalSex;
  status: AnimalStatus;
  default_image_url: string | null;
  thumbnail_url: string | null;
  primary_photo_url: string | null;
  public_code: string | null;
  date_of_birth: string | null;
  color: string | null;
  breeds: AnimalBreed[];
  current_kennel_name: string | null;
  current_kennel_code: string | null;
}

export interface AnimalsListResponse {
  items: AnimalListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// Full animal detail returned by GET /animals/{id}
export interface Animal extends AnimalListItem {
  organization_id: string;
  birth_date_estimated: string | null;
  age_group: string | null;
  coat: string | null;
  collar_color: string | null;
  size_estimated: string | null;
  weight_current_kg: number | null;
  weight_estimated_kg: number | null;
  mer_kcal_per_day: number | null;
  altered_status: string;
  status_reason: string | null;
  outcome_date: string | null;
  description: string | null;
  public_visibility: boolean;
  featured: boolean;
  is_dewormed: boolean;
  is_aggressive: boolean;
  is_pregnant: boolean;
  is_lactating: boolean;
  is_critical: boolean;
  is_diabetic: boolean;
  is_cancer: boolean;
  is_special_needs: boolean;
  bcs: number | null;
  behavior_notes: string | null;
  primary_photo_url: string | null;
  thumbnail_url: string | null;
  current_kennel_id: string | null;
  last_walked_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  identifiers: AnimalIdentifier[];
  estimated_age_years: number | null;
  current_intake_date: string | null;
  current_intake_reason: string | null;
}
