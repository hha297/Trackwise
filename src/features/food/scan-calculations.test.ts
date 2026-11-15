import { describe, expect, it } from 'vitest';

import {
  rescaleLoggedNutrition,
  scaleNutritionForAmount,
  suggestedMealForDate,
} from './scan-calculations';

const nutrition = { calories: 200, proteinG: 10, carbsG: null, fatG: 4, fiberG: 5 };

describe('scaleNutritionForAmount', () => {
  it('scales per-100 g without replacing missing values', () => {
    expect(scaleNutritionForAmount(nutrition, { kind: 'per100', unit: 'g' }, 35, 'g')).toEqual({
      calories: 70,
      proteinG: 3.5,
      carbsG: null,
      fatG: 1.4,
      fiberG: 1.75,
      sugarsG: null,
      saturatedFatG: null,
      sodiumMg: null,
      saltG: null,
    });
  });

  it('scales servings once', () => {
    expect(
      scaleNutritionForAmount(
        nutrition,
        { kind: 'serving', label: '30 g', amount: 30, unit: 'g' },
        2,
        'serving',
      ),
    ).toEqual({
      calories: 400,
      proteinG: 20,
      carbsG: null,
      fatG: 8,
      fiberG: 10,
      sugarsG: null,
      saturatedFatG: null,
      sodiumMg: null,
      saltG: null,
    });
  });

  it('uses a trusted serving conversion with per-100 nutrition', () => {
    expect(
      scaleNutritionForAmount(nutrition, { kind: 'per100', unit: 'g' }, 2, 'serving', {
        amount: 30,
        unit: 'g',
      }),
    ).toEqual({
      calories: 120,
      proteinG: 6,
      carbsG: null,
      fatG: 2.4,
      fiberG: 3,
      sugarsG: null,
      saturatedFatG: null,
      sodiumMg: null,
      saltG: null,
    });
  });

  it('does not invent a gram conversion for an unknown serving', () => {
    expect(() =>
      scaleNutritionForAmount(
        nutrition,
        { kind: 'serving', label: '1 package', amount: null, unit: null },
        50,
        'g',
      ),
    ).toThrow();
  });
});

describe('rescaleLoggedNutrition', () => {
  it('recalculates proportionally when amount changes', () => {
    expect(
      rescaleLoggedNutrition(
        { calories: 160, proteinG: 27, carbsG: 10, fatG: 0.5, fiberG: null },
        250,
        125,
      ),
    ).toEqual({
      calories: 80,
      proteinG: 13.5,
      carbsG: 5,
      fatG: 0.25,
      fiberG: null,
      sugarsG: null,
      saturatedFatG: null,
      sodiumMg: null,
      saltG: null,
    });
  });
});

describe('suggestedMealForDate', () => {
  it('suggests by local hour only for today', () => {
    expect(suggestedMealForDate('2026-10-29', '2026-10-29', 8)).toBe('breakfast');
    expect(suggestedMealForDate('2026-10-29', '2026-10-29', 16)).toBe('dinner');
    expect(suggestedMealForDate('2026-10-28', '2026-10-29', 8)).toBeNull();
  });
});
