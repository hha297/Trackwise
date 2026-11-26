import {
  FLEXIBLE_DAY_RATIO,
  LIGHTER_DAY_RATIO,
  OVERRIDE_CALORIE_MAX,
  OVERRIDE_CALORIE_MIN,
} from './constants';
import type { DailyOverride, OverridePreset } from './types';

export type EffectiveCalorieTarget = {
  original: number;
  effective: number;
  adjusted: boolean;
  preset: OverridePreset;
};

export type OverrideValidation =
  | { ok: true; calories: number }
  | { ok: false; reason: 'missing_original' | 'not_integer' | 'too_low' | 'too_high' | 'unchanged' };

/**
 * Same-day calorie target. The stored Goal is never mutated here.
 * An override applies only when override.overrideDate === dateKey.
 */
export function resolveEffectiveCalorieTarget(input: {
  original: number | null | undefined;
  dateKey: string;
  override: DailyOverride | null | undefined;
}): EffectiveCalorieTarget | null {
  const original = input.original;
  if (original == null || !(original > 0)) return null;
  const match =
    input.override && input.override.overrideDate === input.dateKey ? input.override : null;
  if (!match) {
    return { original, effective: original, adjusted: false, preset: 'usual' };
  }
  return {
    original,
    effective: match.calories,
    adjusted: match.calories !== original,
    preset: classifyOverridePreset(original, match.calories),
  };
}

export function classifyOverridePreset(original: number, calories: number): OverridePreset {
  if (calories === original) return 'usual';
  if (calories === lighterDayCalories(original)) return 'lighter';
  if (calories === flexibleDayCalories(original)) return 'flexible';
  return 'custom';
}

export function lighterDayCalories(original: number): number {
  const proposed = Math.round(original * LIGHTER_DAY_RATIO);
  return clampOverrideCalories(Math.min(original, proposed));
}

export function flexibleDayCalories(original: number): number {
  const proposed = Math.round(original * FLEXIBLE_DAY_RATIO);
  return clampOverrideCalories(Math.max(original, proposed));
}

export function clampOverrideCalories(value: number): number {
  return Math.min(OVERRIDE_CALORIE_MAX, Math.max(OVERRIDE_CALORIE_MIN, Math.round(value)));
}

export function validateOverrideCalories(input: {
  original: number | null | undefined;
  raw: string | number;
}): OverrideValidation {
  if (input.original == null || !(input.original > 0)) {
    return { ok: false, reason: 'missing_original' };
  }
  const value = typeof input.raw === 'number' ? input.raw : Number(String(input.raw).trim());
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, reason: 'not_integer' };
  }
  if (value < OVERRIDE_CALORIE_MIN) return { ok: false, reason: 'too_low' };
  if (value > OVERRIDE_CALORIE_MAX) return { ok: false, reason: 'too_high' };
  if (value === input.original) return { ok: false, reason: 'unchanged' };
  return { ok: true, calories: value };
}

/** Lighter-day chip is hidden when it would not actually change the target. */
export function canOfferLighterDay(original: number): boolean {
  return lighterDayCalories(original) < original;
}

export function canOfferFlexibleDay(original: number): boolean {
  return flexibleDayCalories(original) > original;
}
