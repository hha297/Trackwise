import { describe, expect, it } from 'vitest';

import { derivePlannedMealLogStatus, plannedMealClientRequestId } from './status';
import type { PlannedMeal } from './types';

function meal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    id: 'plan-1',
    plan_date: '2026-11-14',
    meal_type: 'breakfast',
    recipe_id: 'recipe-1',
    title: 'Oats',
    notes: null,
    servings: 2,
    calories: 400,
    protein_g: 20,
    carbs_g: 60,
    fat_g: 10,
    logged_food_entry_id: null,
    logged_servings: null,
    logged_at: null,
    created_at: '2026-11-14T00:00:00Z',
    updated_at: '2026-11-14T00:00:00Z',
    ...overrides,
  };
}

describe('derivePlannedMealLogStatus', () => {
  it('returns planned when no diary link', () => {
    expect(derivePlannedMealLogStatus(meal())).toBe('planned');
  });

  it('returns planned when link fields are incomplete after diary delete', () => {
    expect(
      derivePlannedMealLogStatus(
        meal({ logged_food_entry_id: null, logged_servings: null, logged_at: null }),
      ),
    ).toBe('planned');
    expect(
      derivePlannedMealLogStatus(
        meal({ logged_food_entry_id: 'entry-1', logged_servings: null }),
      ),
    ).toBe('planned');
  });

  it('returns partial when logged servings are below planned', () => {
    expect(
      derivePlannedMealLogStatus(
        meal({ logged_food_entry_id: 'entry-1', logged_servings: 1, logged_at: '2026-11-14T08:00:00Z' }),
      ),
    ).toBe('partial');
  });

  it('returns logged when logged servings meet or exceed planned', () => {
    expect(
      derivePlannedMealLogStatus(
        meal({ logged_food_entry_id: 'entry-1', logged_servings: 2, logged_at: '2026-11-14T08:00:00Z' }),
      ),
    ).toBe('logged');
    expect(
      derivePlannedMealLogStatus(
        meal({ logged_food_entry_id: 'entry-1', logged_servings: 2.5, logged_at: '2026-11-14T08:00:00Z' }),
      ),
    ).toBe('logged');
  });
});

describe('plannedMealClientRequestId', () => {
  it('is stable and unique per plan id', () => {
    expect(plannedMealClientRequestId('abc')).toBe('planned_meal:abc');
  });
});
