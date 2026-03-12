export interface HotelReservation {
  id: string;
  organization_id: string;
  kennel_id: string;
  kennel_name: string | null;
  contact_id: string | null;
  animal_name: string;
  animal_species: string;
  animal_breed: string | null;
  animal_notes: string | null;
  reserved_from: string;
  reserved_to: string;
  total_price: number | null;
  price_per_day: number | null;
  status: string; // pending, confirmed, checked_in, checked_out, cancelled
  own_food: boolean | null;
  requires_single_cage: boolean;
  is_paid: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
