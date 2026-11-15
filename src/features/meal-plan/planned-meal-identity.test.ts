import { describe, expect, it } from 'vitest';

import type { PlannedMeal } from './types';

function isRecipePlan(meal: Pick<PlannedMeal, 'recipe_id'>) {
  return meal.recipe_id != null;
}

describe('planned meal Food vs Recipe identity', () => {
  it('classifies by recipe_id only', () => {
    expect(isRecipePlan({ recipe_id: 'r1' })).toBe(true);
    expect(isRecipePlan({ recipe_id: null })).toBe(false);
  });
});
