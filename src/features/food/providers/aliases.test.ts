import { describe, expect, it } from 'vitest';

import { detectSearchIntent, expandFoodQuery } from './aliases';
import { dedupeNormalizedFoods } from './dedupe';
import { marketFromLanguage } from './market';
import { rankNormalizedFoods } from './ranking';
import { normalizedFromUsdaSearchFood } from './usda-normalize';
import type { NormalizedFood } from './types';

describe('food provider aliases', () => {
  it('expands Vietnamese pork belly to English', () => {
    const expanded = expandFoodQuery('thịt ba chỉ');
    expect(expanded[0]).toBe('thịt ba chỉ');
    expect(expanded.some((q) => /pork belly/i.test(q))).toBe(true);
  });

  it('detects prepared-dish intent', () => {
    expect(detectSearchIntent('phở bò')).toBe('prepared');
    expect(detectSearchIntent('chicken breast')).toBe('generic');
    expect(detectSearchIntent('Vinamilk milk')).toBe('branded');
  });
});

describe('marketFromLanguage', () => {
  it('maps app languages to default markets', () => {
    expect(marketFromLanguage('vi')).toEqual({ region: 'VN', language: 'vi' });
    expect(marketFromLanguage('fi-FI')).toEqual({ region: 'FI', language: 'fi' });
    expect(marketFromLanguage('sv')).toEqual({ region: 'SE', language: 'sv' });
    expect(marketFromLanguage('en')).toEqual({ region: 'US', language: 'en' });
  });
});

describe('usda normalize', () => {
  it('maps Foundation macros per 100 g and keeps nulls honest', () => {
    const food = normalizedFromUsdaSearchFood({
      fdcId: 171477,
      description: 'Chicken, broiler, breast, skinless, boneless, meat only, raw',
      dataType: 'SR Legacy',
      foodNutrients: [
        { nutrientId: 1008, unitName: 'KCAL', value: 120 },
        { nutrientId: 1003, unitName: 'G', value: 22.5 },
        { nutrientId: 1005, unitName: 'G', value: 0 },
        { nutrientId: 1004, unitName: 'G', value: 2.6 },
      ],
    });
    expect(food).toMatchObject({
      provider: 'usda',
      nutritionBasis: 'per100',
      completeness: 'complete',
      nutrition: { calories: 120, proteinG: 22.5, carbsG: 0, fatG: 2.6 },
    });
    expect(food?.state).toBe('raw');
  });
});

describe('rank + dedupe', () => {
  const base = (partial: Partial<NormalizedFood>): NormalizedFood => ({
    id: 'x',
    provider: 'usda',
    providerFoodId: '1',
    barcode: null,
    name: 'Chicken breast raw',
    brand: null,
    description: null,
    kind: 'generic',
    state: 'raw',
    country: 'US',
    language: 'en',
    imageUrl: null,
    nutritionBasis: 'per100',
    basisUnit: 'g',
    nutrition: { calories: 100, proteinG: 20, carbsG: 0, fatG: 2 },
    servings: [],
    completeness: 'complete',
    rawOrCookedHint: 'raw',
    ...partial,
  });

  it('prefers raw generic over branded cooked for a raw query', () => {
    const ranked = rankNormalizedFoods(
      [
        base({
          id: 'branded',
          provider: 'open_food_facts',
          name: 'Chicken Breast Grilled Meal',
          kind: 'branded',
          state: 'cooked',
        }),
        base({ id: 'raw', name: 'Chicken breast, raw', kind: 'generic', state: 'raw' }),
      ],
      'raw chicken breast',
      'generic',
    );
    expect(ranked[0]?.id).toBe('raw');
  });

  it('dedupes identical barcodes preferring complete records', () => {
    const out = dedupeNormalizedFoods([
      base({
        id: 'a',
        barcode: '123',
        completeness: 'partial',
        nutrition: { calories: 10, proteinG: null, carbsG: null, fatG: null },
      }),
      base({
        id: 'b',
        barcode: '123',
        provider: 'fatsecret',
        completeness: 'complete',
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('b');
  });
});
