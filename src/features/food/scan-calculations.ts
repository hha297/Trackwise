import type { NutritionBasis } from './open-food-facts';

export type NullableNutrition = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG?: number | null;
  sugarsG?: number | null;
  saturatedFatG?: number | null;
  sodiumMg?: number | null;
  /** Open Food Facts salt (g); distinct from sodium mg. */
  saltG?: number | null;
};

export function parsePositiveAmount(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nutritionFactor(
  basis: NutritionBasis,
  amount: number,
  amountUnit: 'g' | 'ml' | 'serving',
  servingConversion?: { amount: number; unit: 'g' | 'ml' } | null,
) {
  if (basis.kind === 'per100') {
    if (amountUnit === basis.unit) {
      return amount / 100;
    }
    if (amountUnit === 'serving' && servingConversion?.unit === basis.unit) {
      return (amount * servingConversion.amount) / 100;
    }
    throw new Error('Amount unit does not match nutrition basis.');
  }
  if (amountUnit === 'serving') {
    return amount;
  }
  if (!basis.amount || basis.unit !== amountUnit) {
    throw new Error('This serving cannot be converted to the selected unit.');
  }
  return amount / basis.amount;
}

function scaleNullable(value: number | null | undefined, factor: number) {
  if (value === null || value === undefined) return null;
  return value * factor;
}

export function scaleNutritionForAmount(
  nutrition: NullableNutrition,
  basis: NutritionBasis,
  amount: number,
  amountUnit: 'g' | 'ml' | 'serving',
  servingConversion?: { amount: number; unit: 'g' | 'ml' } | null,
): NullableNutrition {
  const factor = nutritionFactor(basis, amount, amountUnit, servingConversion);
  return {
    calories: scaleNullable(nutrition.calories, factor),
    proteinG: scaleNullable(nutrition.proteinG, factor),
    carbsG: scaleNullable(nutrition.carbsG, factor),
    fatG: scaleNullable(nutrition.fatG, factor),
    fiberG: scaleNullable(nutrition.fiberG ?? null, factor),
    sugarsG: scaleNullable(nutrition.sugarsG ?? null, factor),
    saturatedFatG: scaleNullable(nutrition.saturatedFatG ?? null, factor),
    sodiumMg: scaleNullable(nutrition.sodiumMg ?? null, factor),
    saltG: scaleNullable(nutrition.saltG ?? null, factor),
  };
}

/**
 * Re-scale an already-logged snapshot when the user changes amount
 * but keeps the same unit (proportional to the previous logged amount).
 */
export function rescaleLoggedNutrition<T extends NullableNutrition>(
  nutrition: T,
  previousAmount: number,
  nextAmount: number,
): T {
  if (!(previousAmount > 0) || !(nextAmount > 0)) {
    throw new Error('Amount must be positive.');
  }
  const factor = nextAmount / previousAmount;
  const scale = (value: number | null | undefined) =>
    value === null || value === undefined ? null : value * factor;
  return {
    ...nutrition,
    calories: scale(nutrition.calories),
    proteinG: scale(nutrition.proteinG),
    carbsG: scale(nutrition.carbsG),
    fatG: scale(nutrition.fatG),
    fiberG: scale(nutrition.fiberG),
    sugarsG: scale(nutrition.sugarsG),
    saturatedFatG: scale(nutrition.saturatedFatG),
    sodiumMg: scale(nutrition.sodiumMg),
    saltG: scale(nutrition.saltG),
  };
}

export function suggestedMealForDate(dateKey: string, todayKey: string, hour: number) {
  if (dateKey !== todayKey) return null;
  if (hour < 11) return 'breakfast' as const;
  if (hour < 15) return 'lunch' as const;
  if (hour < 21) return 'dinner' as const;
  return 'snacks' as const;
}
