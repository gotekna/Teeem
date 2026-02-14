// SSoT: PricebookItem type definitions
// Import from @/lib/types - NEVER define locally

export interface PricebookItem {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  unit?: string;
  current_price?: number | null;
  price?: number;
  category?: string | null;
  preferred_supplier_name?: string | null;
  supplier_id?: number | null;
  active?: boolean;
  item_code?: string;
  item_name?: string;
  colour?: string | null;
  colour_code?: string | null;
  colour_brand?: string | null;
  default_supplier?: string | null;
}
