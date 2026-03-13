export interface FeedingPlan {
  id: string;
  is_active: boolean;
  animal_id: string | null;
  animal_name: string | null;
  animal_public_code: string | null;
  food_id: string | null;
  food_name: string | null;
  food_brand: string | null;
  amount_g: number | null;
  amount_text: string | null;
  times_per_day: number | null;
  schedule_json: string[] | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
}
