export type InventoryCategory = 'medication' | 'vaccine' | 'food' | 'supply' | 'other';

export interface InventoryItem {
  id: string;
  organization_id: string;
  name: string;
  category: InventoryCategory;
  unit: string | null;
  reorder_threshold: number | null;
  kcal_per_100g: number | null;
  price_per_unit: number | null;
  allowed_species: string[] | null;
  food_type: string | null;
  shelf_life_days: number | null;
  unit_weight_g: number | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryStock {
  item: InventoryItem;
  total_quantity: number;
  lots_count: number;
  oldest_expiry: string | null;
}

export interface InventoryLot {
  id: string;
  organization_id: string;
  item_id: string;
  lot_number: string | null;
  expires_at: string | null;
  quantity: number;
  cost_per_unit: number | null;
  created_at: string;
  updated_at: string;
}

export type TransactionDirection = 'in' | 'out' | 'adjust';
export type TransactionReason = 'opening_balance' | 'purchase' | 'donation' | 'consumption' | 'writeoff';

export interface InventoryTransaction {
  id: string;
  organization_id: string;
  item_id: string;
  lot_id: string | null;
  direction: TransactionDirection;
  reason: TransactionReason;
  quantity: number;
  note: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
}
