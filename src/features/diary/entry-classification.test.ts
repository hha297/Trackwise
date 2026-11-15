import { describe, expect, it } from 'vitest';

import { classifyDiaryEntry } from './entry-classification';

describe('classifyDiaryEntry', () => {
  it('prefers planned_meal_id over everything else', () => {
    expect(
      classifyDiaryEntry({
        planned_meal_id: 'pm-1',
        entry_source: 'scanned_product',
        recipe_id: 'r-1',
        food_id: 'f-1',
      }),
    ).toBe('planned_meal');
  });

  it('classifies explicit recipe source', () => {
    expect(
      classifyDiaryEntry({
        planned_meal_id: null,
        entry_source: 'recipe',
        recipe_id: 'r-1',
        food_id: null,
      }),
    ).toBe('recipe');
  });

  it('classifies scanned_product only when entry_source says so', () => {
    expect(
      classifyDiaryEntry({
        planned_meal_id: null,
        entry_source: 'scanned_product',
        recipe_id: null,
        food_id: 'f-1',
      }),
    ).toBe('scanned_product');
  });

  it('does not treat nutrition-like legacy rows as scanned', () => {
    expect(
      classifyDiaryEntry({
        planned_meal_id: null,
        entry_source: null,
        recipe_id: null,
        food_id: null,
      }),
    ).toBe('unknown');
  });

  it('maps legacy linked food_id to catalog', () => {
    expect(
      classifyDiaryEntry({
        planned_meal_id: null,
        entry_source: null,
        recipe_id: null,
        food_id: 'f-1',
      }),
    ).toBe('catalog');
  });

  it('treats recipe_id without entry_source as recipe (post-migration lineage)', () => {
    expect(
      classifyDiaryEntry({
        planned_meal_id: null,
        entry_source: null,
        recipe_id: 'r-1',
        food_id: null,
      }),
    ).toBe('recipe');
  });

  it('does not infer scanned from food_id alone', () => {
    expect(
      classifyDiaryEntry({
        planned_meal_id: null,
        entry_source: 'catalog',
        recipe_id: null,
        food_id: 'f-1',
      }),
    ).toBe('catalog');
  });
});
