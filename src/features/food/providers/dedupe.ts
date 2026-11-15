import type { NormalizedFood } from './types';

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function providerPriority(provider: NormalizedFood['provider']) {
  switch (provider) {
    case 'fatsecret':
      return 3;
    case 'usda':
      return 2;
    case 'open_food_facts':
      return 1;
    default:
      return 0;
  }
}

/**
 * Deduplicate only when identity is strong (same barcode, or same provider id).
 * Never merge raw vs cooked / different cuts by fuzzy name alone.
 */
export function dedupeNormalizedFoods(foods: NormalizedFood[]): NormalizedFood[] {
  const byKey = new Map<string, NormalizedFood>();

  for (const food of foods) {
    const barcode = food.barcode?.replace(/\D/g, '') || null;
    const key = barcode
      ? `bc:${barcode}`
      : `id:${food.provider}:${food.providerFoodId}`;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, food);
      continue;
    }

    // Prefer more complete nutrition, then higher-trust provider.
    const preferNew =
      (food.completeness === 'complete' && existing.completeness !== 'complete') ||
      (food.completeness === existing.completeness &&
        providerPriority(food.provider) > providerPriority(existing.provider));

    if (preferNew) byKey.set(key, food);
  }

  // Secondary pass: same folded name + brand + state from different providers without barcode.
  const byName = new Map<string, NormalizedFood>();
  for (const food of byKey.values()) {
    if (food.barcode) {
      byName.set(`keep:${food.id}`, food);
      continue;
    }
    const nameKey = `${fold(food.name)}|${fold(food.brand ?? '')}|${food.state}`;
    const existing = byName.get(nameKey);
    if (!existing) {
      byName.set(nameKey, food);
      continue;
    }
    const preferNew =
      (food.completeness === 'complete' && existing.completeness !== 'complete') ||
      providerPriority(food.provider) > providerPriority(existing.provider);
    if (preferNew) byName.set(nameKey, food);
  }

  return [...byName.values()];
}
