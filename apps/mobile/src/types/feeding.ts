export interface FeedingPlan {
  id: string;
  is_active: boolean;
  animal: { id: string; name: string; species: string; public_code: string | null } | null;
  food: { id: string; name: string; brand: string | null } | null;
  amount_g: number | null;
  amount_text: string | null;
  times_per_day: number | null;
  schedule_json: string[] | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
}
