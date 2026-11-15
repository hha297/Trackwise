import { describe, expect, it } from 'vitest';

import {
  actualIntakeSummary,
  previewActualIntake,
  snapServings,
  stepServings,
} from './intake-display';
import type { PlannedMeal } from './types';

function meal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    id: 'plan-1',
    plan_date: '2026-11-14',
    meal_type: 'lunch',
    recipe_id: null,
    title: 'Bowl',
    notes: null,
    servings: 1,
    calories: 236,
    protein_g: 20,
    carbs_g: 24,
    fat_g: 8,
    logged_food_entry_id: null,
    logged_servings: null,
    logged_at: null,
    created_at: '2026-11-14T00:00:00Z',
    updated_at: '2026-11-14T00:00:00Z',
    ...overrides,
  };
}

describe('snapServings / stepServings', () => {
  it('keeps positive serving steps', () => {
    expect(snapServings(1)).toBe(1);
    expect(snapServings(0.7)).toBe(0.75);
    expect(stepServings(1, -1)).toBe(0.75);
    expect(stepServings(0.25, -1)).toBe(0.25);
  });
});

describe('previewActualIntake', () => {
  it('scales food nutrition by actual servings', () => {
    expect(previewActualIntake(meal(), 0.75)).toEqual({
      calories: 177,
      proteinG: 15,
      carbsG: 18,
      fatG: 6,
    });
  });

  it('scales recipe nutrition the same way (shared snapshot macros)', () => {
    const recipe = meal({ recipe_id: 'r1', servings: 2, calories: 500, protein_g: 40 });
    expect(previewActualIntake(recipe, 1)?.calories).toBe(250);
  });

  it('returns null for invalid amounts', () => {
    expect(previewActualIntake(meal(), 0)).toBeNull();
  });
});

describe('actualIntakeSummary', () => {
  it('is not logged when diary link is missing', () => {
    expect(actualIntakeSummary(meal()).status).toBe('planned');
    expect(actualIntakeSummary(meal()).servings).toBeNull();
  });

  it('returns partial when logged below planned', () => {
    const summary = actualIntakeSummary(
      meal({
        logged_food_entry_id: 'e1',
        logged_servings: 0.75,
        logged_at: '2026-11-14T08:00:00Z',
      }),
    );
    expect(summary.status).toBe('partial');
    expect(summary.servings).toBe(0.75);
    expect(summary.calories).toBe(177);
    expect(summary.remainingServings).toBe(0.25);
  });

  it('returns logged when actual meets planned', () => {
    const summary = actualIntakeSummary(
      meal({
        logged_food_entry_id: 'e1',
        logged_servings: 1,
        logged_at: '2026-11-14T08:00:00Z',
      }),
    );
    expect(summary.status).toBe('logged');
    expect(summary.remainingServings).toBeNull();
  });

  it('keeps planned nutrition independent of logged servings', () => {
    const planned = meal({
      servings: 1,
      calories: 236,
      logged_food_entry_id: 'e1',
      logged_servings: 0.75,
      logged_at: '2026-11-14T08:00:00Z',
    });
    expect(planned.calories).toBe(236);
    expect(actualIntakeSummary(planned).calories).toBe(177);
  });
});
