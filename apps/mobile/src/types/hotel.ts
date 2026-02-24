export interface HotelReservation {
  id: string;
  kennel_id: string;
  kennel_name: string | null;
  animal_name: string;
  animal_species: string;
  animal_breed: string | null;
  reserved_from: string;
  reserved_to: string;
  total_price: number | null;
  price_per_day: number | null;
  status: string; // pending, confirmed, checked_in, checked_out, cancelled
  own_food: boolean | null;
  is_paid: boolean;
  notes: string | null;
}
