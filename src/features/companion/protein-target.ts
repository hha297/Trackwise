import { resolveDietFromGoal } from '@/features/diary/diet-presets';
import type { Goal } from '@/features/goals/types';

/** Absolute protein grams from the stored goal — not scaled by a same-day calorie override. */
export function proteinTargetFromGoal(goal: Goal | null | undefined): number | null {
  if (!goal) return null;
  if (goal.protein_g != null && goal.protein_g > 0) return Math.round(goal.protein_g);
  if (!(goal.daily_calorie_target > 0)) return null;
  const diet = resolveDietFromGoal({
    dailyCalorieTarget: goal.daily_calorie_target,
    carbsG: goal.carbs_g,
    proteinG: goal.protein_g,
    fatG: goal.fat_g,
    carbsPct: goal.carbs_pct,
    proteinPct: goal.protein_pct,
    fatPct: goal.fat_pct,
    dietPreset: goal.diet_preset,
  });
  return diet.grams.proteinG > 0 ? diet.grams.proteinG : null;
}
