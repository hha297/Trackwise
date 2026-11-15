import type { NormalizedNutrition, NutritionCompleteness } from './types';

export function nutritionCompleteness(n: NormalizedNutrition): NutritionCompleteness {
  const macros = [n.calories, n.proteinG, n.carbsG, n.fatG];
  const present = macros.filter((v) => v != null && Number.isFinite(v)).length;
  if (present === 4) return 'complete';
  if (present === 0) return 'insufficient';
  return 'partial';
}

export function roundNutrient(value: number | null | undefined, digits = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
