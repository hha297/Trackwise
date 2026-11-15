import { describe, expect, it } from 'vitest';

import {
  draftFromFood,
  ingredientContribution,
  scalePlannedMacros,
  sumRecipeMacros,
  sumRecipeMacrosFromDrafts,
} from './calculations';

describe('recipe calculations', () => {
  it('scales per-100g ingredients by grams', () => {
    const part = ingredientContribution({
      amount: 50,
      amountUnit: 'g',
      nutritionBasis: 'per100',
      basisAmount: 100,
      basisUnit: 'g',
      servingGrams: null,
      calories: 200,
      proteinG: 10,
      carbsG: 20,
      fatG: 5,
    });
    expect(part.calories).toBe(100);
    expect(part.proteinG).toBe(5);
  });

  it('scales serving-based ingredients by mass amount', () => {
    const part = ingredientContribution({
      amount: 200,
      amountUnit: 'g',
      nutritionBasis: 'serving',
      basisAmount: 100,
      basisUnit: 'g',
      servingGrams: 100,
      calories: 120,
      proteinG: 8,
      carbsG: 4,
      fatG: 2,
    });
    expect(part.calories).toBe(240);
    expect(part.proteinG).toBe(16);
  });

  it('returns null macros when serving basis cannot convert to the amount unit', () => {
    const part = ingredientContribution({
      amount: 100,
      amountUnit: 'ml',
      nutritionBasis: 'serving',
      basisAmount: 1,
      basisUnit: 'serving',
      servingGrams: null,
      calories: 50,
      proteinG: 1,
      carbsG: 1,
      fatG: 1,
    });
    expect(part.calories).toBeNull();
    expect(part.proteinG).toBeNull();
  });

  it('sums totals and per-serving values', () => {
    const drafts = [
      draftFromFood({
        key: 'a',
        foodId: '1',
        name: 'Rice',
        brand: null,
        calories: 200,
        proteinG: 4,
        carbsG: 40,
        fatG: 1,
        servingGrams: 150,
      }),
      draftFromFood({
        key: 'b',
        foodId: '2',
        name: 'Chicken',
        brand: null,
        calories: 160,
        proteinG: 30,
        carbsG: 0,
        fatG: 4,
        servingGrams: 100,
      }),
    ];
    // Full declared serving masses (g/ml editor amounts).
    drafts[0]!.amount = 150;
    drafts[1]!.amount = 100;
    const { total, perServing } = sumRecipeMacrosFromDrafts(drafts, 2);
    expect(total.calories).toBe(360);
    expect(perServing.calories).toBe(180);
    expect(total.complete).toBe(true);
  });

  it('defaults per-100 foods to a 100 g/ml amount', () => {
    const draft = draftFromFood({
      key: 'c',
      foodId: '3',
      name: 'Apple',
      brand: null,
      calories: 52,
      proteinG: 0.3,
      carbsG: 14,
      fatG: 0.2,
      servingGrams: 100,
      servingLabel: '100 g',
      nutritionBasis: 'per100',
      basisUnit: 'g',
      imageUrl: 'https://example.com/apple.jpg',
    });
    expect(draft).toMatchObject({
      amount: 100,
      amountUnit: 'g',
      nutritionBasis: 'per100',
      imageUrl: 'https://example.com/apple.jpg',
    });
  });

  it('defaults liquid foods to ml and never uses serving amounts', () => {
    const draft = draftFromFood({
      key: 'd',
      foodId: '4',
      name: 'Milk',
      brand: null,
      calories: 64,
      proteinG: 3.2,
      carbsG: 5,
      fatG: 3.5,
      servingGrams: null,
      servingLabel: '100 ml',
      nutritionBasis: 'per100',
      basisUnit: 'ml',
    });
    expect(draft.amountUnit).toBe('ml');
    expect(draft.amount).toBe(100);
    expect(draft.nutritionBasis).toBe('per100');
  });

  it('treats empty recipes as complete zero totals', () => {
    const { total, perServing } = sumRecipeMacros([], 3);
    expect(total).toEqual({
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      complete: true,
    });
    expect(perServing.calories).toBe(0);
  });

  it('scales per-100 nutrition for either g or ml amounts', () => {
    const base = {
      amount: 200,
      nutritionBasis: 'per100' as const,
      basisAmount: 100,
      basisUnit: 'ml' as const,
      servingGrams: null,
      calories: 40,
      proteinG: 0,
      carbsG: 10,
      fatG: 0,
    };
    expect(ingredientContribution({ ...base, amountUnit: 'ml' }).calories).toBe(80);
    expect(ingredientContribution({ ...base, amountUnit: 'g' }).calories).toBe(80);
  });

  it('rejects non-positive amounts as zero contribution', () => {
    const part = ingredientContribution({
      amount: 0,
      amountUnit: 'g',
      nutritionBasis: 'per100',
      basisAmount: 100,
      basisUnit: 'g',
      servingGrams: null,
      calories: 100,
      proteinG: 1,
      carbsG: 1,
      fatG: 1,
    });
    expect(part.calories).toBe(0);
  });

  it('scales planned macros when servings change', () => {
    expect(
      scalePlannedMacros({ calories: 400, proteinG: 40, carbsG: 20, fatG: 10 }, 2, 1),
    ).toEqual({ calories: 200, proteinG: 20, carbsG: 10, fatG: 5 });
  });

  it('throws when planned servings are invalid', () => {
    expect(() =>
      scalePlannedMacros({ calories: 100, proteinG: 1, carbsG: 1, fatG: 1 }, 0, 1),
    ).toThrow(/Servings must be positive/);
  });
});
