export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type FoodAmountUnit = 'g' | 'ml' | 'serving';

export type FoodEntrySource =
  | 'planned_meal'
  | 'recipe'
  | 'scanned_product'
  | 'catalog'
  | 'manual';

export type FoodEntry = {
  id: string;
  logged_on: string;
  meal_type: MealType;
  quantity: number;
  food_name: string;
  brand: string | null;
  serving_label: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  amount?: number | null;
  amount_unit?: FoodAmountUnit | null;
  nutrition_basis?: 'per100' | 'serving' | null;
  basis_amount?: number | null;
  basis_unit?: FoodAmountUnit | null;
  image_url?: string | null;
  /** Null = unavailable (do not treat as zero). */
  fiber_g?: number | null;
  sugars_g?: number | null;
  saturated_fat_g?: number | null;
  sodium_mg?: number | null;
  food_id?: string | null;
  /** Origin planned meal when logged via Meal Plan → Diary. */
  planned_meal_id?: string | null;
  /** Optional recipe lineage for direct recipe logs. */
  recipe_id?: string | null;
  /** Explicit origin discriminator; null = legacy/unknown. */
  entry_source?: FoodEntrySource | null;
};

export type Food = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_label: string;
  serving_grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string;
  image_url?: string | null;
  nutrition_basis?: 'per100' | 'serving' | null;
  basis_unit?: 'g' | 'ml' | 'serving' | null;
  basis_amount?: number | null;
};
