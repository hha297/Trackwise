import type { FoodEntry } from '@/features/food/types';

/** Canonical diary row kinds for UI — never infer from image_url / nutrition_basis. */
export type DiaryEntryKind =
  | 'planned_meal'
  | 'recipe'
  | 'scanned_product'
  | 'catalog'
  | 'manual'
  | 'unknown';

export type FoodEntrySource =
  | 'planned_meal'
  | 'recipe'
  | 'scanned_product'
  | 'catalog'
  | 'manual';

/**
 * Classify a diary entry for presentation.
 * Precedence: planned_meal_id → entry_source → unknown (safe generic).
 */
export function classifyDiaryEntry(
  entry: Pick<FoodEntry, 'planned_meal_id' | 'entry_source' | 'recipe_id' | 'food_id'>,
): DiaryEntryKind {
  if (entry.planned_meal_id != null) return 'planned_meal';
  if (entry.entry_source === 'planned_meal') return 'planned_meal';
  if (entry.entry_source === 'recipe' || (entry.recipe_id != null && entry.entry_source == null)) {
    return 'recipe';
  }
  if (entry.entry_source === 'scanned_product') return 'scanned_product';
  if (entry.entry_source === 'catalog') return 'catalog';
  if (entry.entry_source === 'manual') return 'manual';
  // Legacy rows without discriminator — do not invent scan/recipe labels.
  if (entry.food_id != null) return 'catalog';
  return 'unknown';
}

export function isScannedProductKind(kind: DiaryEntryKind) {
  return kind === 'scanned_product';
}
