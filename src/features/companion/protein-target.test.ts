import { describe, expect, it } from 'vitest';

import type { Goal } from '@/features/goals/types';

import { proteinTargetFromGoal } from './protein-target';

const goal = (patch: Partial<Goal>): Goal =>
  ({
    id: 'g1',
    goal_type: 'maintain_weight',
    target_weight_kg: null,
    daily_calorie_target: 2000,
    weekly_change_kg: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    fiber_g: null,
    diet_preset: 'balanced',
    carbs_pct: 50,
    protein_pct: 20,
    fat_pct: 30,
    is_active: true,
    ...patch,
  }) as Goal;

describe('proteinTargetFromGoal', () => {
  it('prefers stored protein grams over a calorie override-style recalculation', () => {
    expect(proteinTargetFromGoal(goal({ protein_g: 140 }))).toBe(140);
  });

  it('falls back to diet grams from the original calorie target', () => {
    expect(proteinTargetFromGoal(goal({ protein_g: null }))).toBe(100);
  });

  it('returns null without a goal', () => {
    expect(proteinTargetFromGoal(null)).toBeNull();
  });
});
