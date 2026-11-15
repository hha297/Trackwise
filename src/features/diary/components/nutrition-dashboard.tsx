import {
  Beef,
  ChevronDown,
  Droplets,
  Leaf,
  Target,
  UtensilsCrossed,
  Wheat,
  Zap,
} from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import {
  entriesToMacros,
  groupEntriesByDate,
  weekDateKeys,
} from '@/features/diary/aggregations';
import { calculateDailyBalance } from '@/features/diary/balance';
import { ProgressRing } from '@/features/diary/components/charts/progress-ring';
import { DietSelectorModal } from '@/features/diary/components/diet-selector-modal';
import { PeriodSwitch } from '@/features/diary/components/period-switch';
import {
  resolveDietFromGoal,
  resolveFiberTarget,
  type DietPresetId,
} from '@/features/diary/diet-presets';
import { useFoodEntriesInRange } from '@/features/diary/hooks';
import type { FoodEntry } from '@/features/food/types';
import type { Goal, Profile } from '@/features/goals/types';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey } from '@/utils/date';

export type DiaryPeriod = 'day' | 'week';

type NutritionDashboardProps = {
  dateKey: string;
  todayKey: string;
  locale: string;
  period: DiaryPeriod;
  onPeriodChange: (period: DiaryPeriod) => void;
  goal: Goal | null | undefined;
  profile: Profile | null | undefined;
  weightKg: number | null;
  dayEntries: FoodEntry[];
  dayBurned: number;
};

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(Math.round(value));
}

export function NutritionDashboard({
  dateKey,
  todayKey,
  locale,
  period,
  onPeriodChange,
  goal,
  profile,
  weightKg,
  dayEntries,
  dayBurned,
}: NutritionDashboardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [dietOpen, setDietOpen] = useState(false);

  const calorieTarget = goal?.daily_calorie_target ?? 2000;
  const diet = resolveDietFromGoal({
    dailyCalorieTarget: calorieTarget,
    carbsG: goal?.carbs_g,
    proteinG: goal?.protein_g,
    fatG: goal?.fat_g,
    carbsPct: goal?.carbs_pct,
    proteinPct: goal?.protein_pct,
    fatPct: goal?.fat_pct,
    dietPreset: goal?.diet_preset as DietPresetId | null | undefined,
  });
  const fiberTarget = resolveFiberTarget({
    storedFiberG: goal?.fiber_g,
    calorieTarget,
    sex: profile?.sex,
  });

  const weekKeys = useMemo(() => weekDateKeys(dateKey), [dateKey]);
  const weekStart = weekKeys[0]!;
  const weekEnd = weekKeys[weekKeys.length - 1]!;
  const weekFood = useFoodEntriesInRange(weekStart, weekEnd);

  const dayMacros = entriesToMacros(dayEntries);
  const weekEntries = useMemo(() => weekFood.data ?? [], [weekFood.data]);
  const weekMacros = entriesToMacros(weekEntries);
  const entriesByDate = useMemo(() => groupEntriesByDate(weekEntries), [weekEntries]);

  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );

  const weekBars = weekKeys.map((key) => {
    const dayCals =
      key > todayKey ? null : entriesToMacros(entriesByDate.get(key) ?? []).calories;
    return {
      key,
      label: weekdayFmt.format(parseDiaryDateKey(key)).replace(/\.$/, ''),
      value: dayCals,
    };
  });

  const consumed = period === 'day' ? dayMacros.calories : weekMacros.calories;
  const burned = dayBurned;
  const carbs = period === 'day' ? dayMacros.carbsG : weekMacros.carbsG;
  const protein = period === 'day' ? dayMacros.proteinG : weekMacros.proteinG;
  const fat = period === 'day' ? dayMacros.fatG : weekMacros.fatG;
  const fiberConsumed: number | null = null;
  const macroTargetMultiplier = period === 'week' ? 7 : 1;
  const carbsTarget = diet.grams.carbsG * macroTargetMultiplier;
  const proteinTarget = diet.grams.proteinG * macroTargetMultiplier;
  const fatTarget = diet.grams.fatG * macroTargetMultiplier;
  const fiberTargetWeek = fiberTarget * macroTargetMultiplier;
  const weekCalorieTarget = calorieTarget * 7;

  const balance = calculateDailyBalance({
    consumed: period === 'day' ? consumed : dayMacros.calories,
    burned,
    target: calorieTarget,
  });
  const over = balance.remaining < 0;
  const dietLabel = t(`diary.diet.preset.${diet.preset}`);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="headingSmall" className="min-w-0 flex-1" numberOfLines={2}>
          {t('diary.nutrition.sectionTitle')}
        </Text>
        <PeriodSwitch
          value={period}
          dayLabel={t('diary.nutrition.day')}
          weekLabel={t('diary.nutrition.week')}
          onChange={onPeriodChange}
        />
      </View>

      {period === 'day' ? (
        <View className="w-full flex-row items-center">
          <View className="items-center justify-center" style={{ flexShrink: 0 }}>
            <ProgressRing
              value={dayMacros.calories}
              max={Math.max(1, calorieTarget)}
              size={132}
              color={colors.macroCalories}
              centerPrimary={formatNumber(dayMacros.calories, locale)}
              centerSecondary={t('diary.nutrition.consumed')}
            />
          </View>
          <View
            className="flex-1 justify-center gap-5 pl-4"
            style={{ alignItems: 'flex-end' }}
          >
            <MetricStackItem
              icon={<Target size={15} color={colors.textSecondary} />}
              label={t('diary.nutrition.toConsume')}
              value={formatNumber(calorieTarget, locale)}
              unit={t('diary.nutrition.kcal')}
            />
            <MetricStackItem
              icon={
                <UtensilsCrossed
                  size={15}
                  color={over ? colors.error : colors.textSecondary}
                />
              }
              label={over ? t('diary.nutrition.exceeded') : t('diary.nutrition.remaining')}
              value={formatNumber(Math.abs(balance.remaining), locale)}
              unit={t('diary.nutrition.kcal')}
              danger={over}
            />
            <MetricStackItem
              icon={<Zap size={15} color={colors.macroActivity} />}
              label={t('diary.nutrition.burned')}
              value={formatNumber(burned, locale)}
              unit={t('diary.nutrition.kcal')}
            />
          </View>
        </View>
      ) : (
        <View className="flex-row items-end gap-3">
          <View className="items-center justify-center" style={{ width: '40%' }}>
            <ProgressRing
              value={weekMacros.calories}
              max={Math.max(1, weekCalorieTarget)}
              size={112}
              color={colors.macroCalories}
              centerPrimary={formatNumber(weekMacros.calories, locale)}
              centerSecondary={t('diary.nutrition.kcal')}
            />
          </View>
          <View className="flex-1" style={{ minHeight: 124 }}>
            <View className="flex-1 flex-row items-end gap-1.5">
              {weekBars.map((bar) => {
                const value = bar.value;
                const target = Math.max(1, calorieTarget);
                const overTarget = value != null && value > target;
                const baseH = 96;
                const trackHeight = overTarget
                  ? baseH + Math.min(28, ((value! - target) / target) * 28)
                  : baseH;
                const fillHeight =
                  value == null || value <= 0
                    ? 0
                    : overTarget
                      ? trackHeight
                      : Math.max(4, (value / target) * baseH);
                const fillColor = overTarget ? colors.error : colors.primary;

                return (
                  <View key={bar.key} className="flex-1 items-center gap-1">
                    <View
                      style={{
                        width: '100%',
                        height: trackHeight,
                        borderRadius: 6,
                        backgroundColor: colors.surfaceMuted,
                        justifyContent: 'flex-end',
                        overflow: 'hidden',
                        opacity: value == null ? 0.45 : 1,
                      }}
                    >
                      {fillHeight > 0 ? (
                        <View
                          style={{
                            width: '100%',
                            height: fillHeight,
                            borderRadius: 6,
                            backgroundColor: fillColor,
                          }}
                        />
                      ) : null}
                    </View>
                    <Text variant="fine" tone="secondary" numberOfLines={1}>
                      {bar.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      <View className="gap-1.5">
        <Text variant="label" tone="secondary">
          {period === 'week'
            ? t('diary.nutrition.macrosWeekHeading')
            : t('diary.nutrition.macrosDayHeading')}
        </Text>
        <View className="flex-row gap-2">
          <NutrientCell
            name={t('diary.macros.carbs')}
            value={carbs}
            target={carbsTarget}
            color={colors.macroCarbs}
            icon={<Wheat size={14} color={colors.macroCarbs} />}
            remainingLabel={t}
          />
          <NutrientCell
            name={t('diary.macros.protein')}
            value={protein}
            target={proteinTarget}
            color={colors.macroProtein}
            icon={<Beef size={14} color={colors.macroProtein} />}
            remainingLabel={t}
          />
        </View>
        <View className="flex-row gap-2">
          <NutrientCell
            name={t('diary.macros.fat')}
            value={fat}
            target={fatTarget}
            color={colors.macroFat}
            icon={<Droplets size={14} color={colors.macroFat} />}
            remainingLabel={t}
          />
          <NutrientCell
            name={t('diary.macros.fiber')}
            value={fiberConsumed}
            target={fiberTargetWeek}
            color={colors.macroFiber}
            icon={<Leaf size={14} color={colors.macroFiber} />}
            remainingLabel={t}
            unavailableNote={t('diary.nutrition.fiberUnavailable')}
          />
        </View>
      </View>

      {period === 'day' ? (
        <View className="gap-2">
          <Text variant="label" tone="secondary">
            {t('diary.diet.currentHeading')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('diary.diet.openSelector')}
            onPress={() => setDietOpen(true)}
            className="flex-row items-center justify-between px-3.5 py-3"
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="bodyStrong">{dietLabel}</Text>
            <ChevronDown size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <DietSelectorModal
        visible={dietOpen}
        onClose={() => setDietOpen(false)}
        goal={goal}
        profile={profile}
        weightKg={weightKg}
        initialPercents={diet.percents}
        initialPreset={diet.preset}
      />
    </Card>
  );
}

function MetricStackItem({
  icon,
  label,
  value,
  unit,
  danger,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  danger?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-end gap-2.5">
      <View className="items-end gap-0.5">
        <Text variant="fine" tone="secondary" numberOfLines={1} style={{ textAlign: 'right' }}>
          {label}
        </Text>
        <View className="flex-row items-baseline justify-end gap-1">
          <Text
            variant="metric"
            tone={danger ? 'error' : 'primary'}
            numberOfLines={1}
          >
            {value}
          </Text>
          <Text variant="fine" tone="secondary">
            {unit}
          </Text>
        </View>
      </View>
      <View className="w-5 items-center">{icon}</View>
    </View>
  );
}

function NutrientCell({
  name,
  value,
  target,
  color,
  icon,
  remainingLabel,
  unavailableNote,
}: {
  name: string;
  value: number | null;
  target: number;
  color: string;
  icon: ReactNode;
  remainingLabel: (key: string, opts?: Record<string, unknown>) => string;
  unavailableNote?: string;
}) {
  const colors = useThemeColors();
  const numeric = value ?? 0;
  const ratio = target > 0 && value != null ? Math.min(1, numeric / target) : 0;
  const remaining = target - numeric;
  let status = '';
  if (value == null) {
    status = unavailableNote ?? '';
  } else if (Math.abs(remaining) < 0.5) {
    status = remainingLabel('diary.macros.achieved');
  } else if (remaining > 0) {
    status = remainingLabel('diary.macros.remaining', { value: Math.round(remaining) });
  } else {
    status = remainingLabel('diary.macros.exceeded', { value: Math.round(Math.abs(remaining)) });
  }

  return (
    <View
      className="flex-1 gap-1.5 px-3.5 py-3"
      style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md }}
    >
      <View className="flex-row items-center gap-1">
        {icon}
        <Text variant="fine" tone="secondary" numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text variant="metric" numberOfLines={1}>
        {value == null ? '—' : Math.round(value)}/{Math.round(target)}g
      </Text>
      <View
        className="h-1 overflow-hidden rounded-full"
        style={{ backgroundColor: colors.border }}
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </View>
      <Text variant="fine" tone="secondary" numberOfLines={1}>
        {status}
      </Text>
    </View>
  );
}
