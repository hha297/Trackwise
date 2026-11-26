import { entriesToMacros } from '@/features/diary/aggregations';
import { calculateDailyBalance } from '@/features/diary/balance';
import { resolveDietFromGoal } from '@/features/diary/diet-presets';
import { unionActiveDayKeys } from '@/features/engagement/activity-days';
import { computeLoggingStreak } from '@/features/engagement/streaks';
import type { FoodEntry } from '@/features/food/types';
import type { Goal, Profile } from '@/features/goals/types';
import {
  DEFAULT_HYDRATION_TARGET_ML,
  intakeForDate,
  mlToFlOz,
  type HydrationEntry,
} from '@/features/hydration/calculations';
import i18n from '@/i18n';
import { toDiaryDateKey } from '@/utils/date';

import {
  formatCompactNumber,
  formatConsumedTarget,
  formatGrams,
  formatPercentDetail,
  formatPercentLabel,
  progressAgainstTarget,
} from './format';
import {
  DAILY_WIDGET_OPEN_URL,
  UNSIGNED_DAILY_WIDGET_PROPS,
  resolveWidgetColorScheme,
  type DailyWidgetProps,
  type WidgetColorScheme,
} from './models';

export type DailySnapshotInput = {
  signedIn: boolean;
  colorScheme?: WidgetColorScheme;
  unavailable?: boolean;
  todayKey?: string;
  locale?: string;
  goal?: Goal | null;
  /** Same-day calorie override. Does not mutate the stored goal. */
  calorieTargetOverride?: number | null;
  profile?: Profile | null;
  foodEntries?: FoodEntry[];
  hydrationEntries?: HydrationEntry[];
  hydrationTargetMl?: number;
  burnedCalories?: number;
  nutritionDayKeys?: string[];
  hydrationDayKeys?: string[];
  workoutDayKeys?: string[];
};

function formatWater(ml: number, imperial: boolean, locale: string): string {
  if (imperial) {
    return `${formatCompactNumber(mlToFlOz(ml), locale)} fl oz`;
  }
  return `${formatCompactNumber(ml, locale)} ml`;
}

export function buildDailyWidgetSnapshot(input: DailySnapshotInput): DailyWidgetProps {
  const colorScheme = resolveWidgetColorScheme(input.colorScheme);
  if (!input.signedIn) {
    return {
      ...UNSIGNED_DAILY_WIDGET_PROPS,
      colorScheme,
      title: i18n.t('widgets.dailyTitle'),
      caloriesLabel: i18n.t('widgets.calories'),
      remainingLabel: i18n.t('widgets.remaining'),
      proteinLabel: i18n.t('widgets.protein'),
      carbsLabel: i18n.t('widgets.carbs'),
      fatLabel: i18n.t('widgets.fat'),
      waterLabel: i18n.t('widgets.water'),
      streakLabel: i18n.t('widgets.streak'),
      hint: i18n.t('widgets.signInDaily'),
    };
  }

  if (input.unavailable) {
    return {
      ...UNSIGNED_DAILY_WIDGET_PROPS,
      signedIn: true,
      colorScheme,
      title: i18n.t('widgets.dailyTitle'),
      caloriesLabel: i18n.t('widgets.calories'),
      remainingLabel: i18n.t('widgets.remaining'),
      proteinLabel: i18n.t('widgets.protein'),
      carbsLabel: i18n.t('widgets.carbs'),
      fatLabel: i18n.t('widgets.fat'),
      waterLabel: i18n.t('widgets.water'),
      streakLabel: i18n.t('widgets.streak'),
      hint: i18n.t('widgets.unavailable'),
    };
  }

  const todayKey = input.todayKey ?? toDiaryDateKey();
  const locale = input.locale ?? i18n.language ?? 'en';
  const imperial = input.profile?.units === 'imperial';
  const kcalUnit = i18n.t('diary.meals.kcalUnit');
  const foodEntries = (input.foodEntries ?? []).filter((entry) => entry.logged_on === todayKey);
  const macros = entriesToMacros(foodEntries);
  const calorieTarget =
    input.calorieTargetOverride != null && input.calorieTargetOverride > 0
      ? input.calorieTargetOverride
      : (input.goal?.daily_calorie_target ?? null);
  const hasCalorieTarget = calorieTarget != null && calorieTarget > 0;
  const burned = Math.max(0, Math.round(input.burnedCalories ?? 0));
  const balance = hasCalorieTarget
    ? calculateDailyBalance({
        consumed: macros.calories,
        burned,
        target: calorieTarget,
      })
    : null;

  const diet = hasCalorieTarget
    ? resolveDietFromGoal({
        dailyCalorieTarget: calorieTarget,
        carbsG: input.goal?.carbs_g,
        proteinG: input.goal?.protein_g,
        fatG: input.goal?.fat_g,
        carbsPct: input.goal?.carbs_pct,
        proteinPct: input.goal?.protein_pct,
        fatPct: input.goal?.fat_pct,
        dietPreset: input.goal?.diet_preset,
      })
    : null;

  const waterTarget = input.hydrationTargetMl ?? DEFAULT_HYDRATION_TARGET_ML;
  const waterMl = intakeForDate(input.hydrationEntries ?? [], todayKey);

  const unionKeys = unionActiveDayKeys(
    input.nutritionDayKeys ?? [],
    input.hydrationDayKeys ?? [],
    input.workoutDayKeys ?? [],
  );
  const streak = unionKeys.length > 0 ? computeLoggingStreak(unionKeys, todayKey) : null;
  const showStreak = Boolean(streak && streak.current > 0);

  const remainingOver = (balance?.remaining ?? 0) < 0;
  const caloriesProgress = hasCalorieTarget
    ? progressAgainstTarget(macros.calories, calorieTarget)
    : 0;
  const caloriesRatio = hasCalorieTarget
    ? formatConsumedTarget(macros.calories, calorieTarget, kcalUnit, locale)
    : formatCompactNumber(macros.calories, locale);
  const caloriesRemainingLine = hasCalorieTarget
    ? `${formatCompactNumber(Math.abs(balance?.remaining ?? 0), locale)} ${
        remainingOver ? i18n.t('widgets.remainingOver') : i18n.t('widgets.remaining')
      }`
    : '';
  const proteinValue = formatGrams(macros.proteinG, locale);
  const carbsValue = formatGrams(macros.carbsG, locale);
  const fatValue = formatGrams(macros.fatG, locale);
  const proteinProgress = diet ? progressAgainstTarget(macros.proteinG, diet.grams.proteinG) : 0;
  const carbsProgress = diet ? progressAgainstTarget(macros.carbsG, diet.grams.carbsG) : 0;
  const fatProgress = diet ? progressAgainstTarget(macros.fatG, diet.grams.fatG) : 0;

  const remainingFootnote = (consumed: number, target: number, unit: 'g' | 'ml') => {
    const left = target - consumed;
    const value = formatCompactNumber(Math.abs(left), locale);
    if (unit === 'g') {
      return i18n.t(left < 0 ? 'widgets.gramsOver' : 'widgets.gramsRemaining', { value });
    }
    return i18n.t(left < 0 ? 'widgets.mlOver' : 'widgets.mlRemaining', { value });
  };

  return {
    signedIn: true,
    colorScheme,
    title: i18n.t('widgets.dailyTitle'),
    caloriesLabel: i18n.t('widgets.calories'),
    caloriesValue: formatCompactNumber(macros.calories, locale),
    caloriesRatio,
    caloriesPercent: hasCalorieTarget ? formatPercentLabel(caloriesProgress, locale) : '',
    remainingLabel: remainingOver ? i18n.t('widgets.remainingOver') : i18n.t('widgets.remaining'),
    remainingValue: hasCalorieTarget
      ? formatCompactNumber(Math.abs(balance?.remaining ?? 0), locale)
      : '—',
    caloriesRemainingLine,
    caloriesProgress,
    proteinLabel: i18n.t('widgets.protein'),
    proteinValue,
    proteinProgress,
    proteinDetail: diet ? formatPercentDetail(proteinProgress, proteinValue) : proteinValue,
    proteinRatio: diet
      ? formatConsumedTarget(macros.proteinG, diet.grams.proteinG, 'g', locale)
      : proteinValue,
    proteinRemainingLine: diet
      ? remainingFootnote(macros.proteinG, diet.grams.proteinG, 'g')
      : '',
    carbsLabel: i18n.t('widgets.carbs'),
    carbsValue,
    carbsProgress,
    carbsDetail: diet ? formatPercentDetail(carbsProgress, carbsValue) : carbsValue,
    carbsRatio: diet
      ? formatConsumedTarget(macros.carbsG, diet.grams.carbsG, 'g', locale)
      : carbsValue,
    carbsRemainingLine: diet ? remainingFootnote(macros.carbsG, diet.grams.carbsG, 'g') : '',
    fatLabel: i18n.t('widgets.fat'),
    fatValue,
    fatProgress,
    fatDetail: diet ? formatPercentDetail(fatProgress, fatValue) : fatValue,
    fatRatio: diet ? formatConsumedTarget(macros.fatG, diet.grams.fatG, 'g', locale) : fatValue,
    fatRemainingLine: diet ? remainingFootnote(macros.fatG, diet.grams.fatG, 'g') : '',
    waterLabel: i18n.t('widgets.water'),
    waterValue: `${formatWater(waterMl, imperial, locale)} / ${formatWater(waterTarget, imperial, locale)}`,
    waterRemainingLine: remainingFootnote(waterMl, waterTarget, 'ml'),
    waterProgress: progressAgainstTarget(waterMl, waterTarget),
    streakLabel: i18n.t('widgets.streak'),
    streakValue: showStreak
      ? i18n.t('widgets.streakDays', { count: streak!.current })
      : '',
    showStreak,
    hint: hasCalorieTarget ? '' : i18n.t('widgets.noTarget'),
    openUrl: DAILY_WIDGET_OPEN_URL,
  };
}
