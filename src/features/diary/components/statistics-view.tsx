import { addDays, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Text } from '@/components/ui/text';
import { ErrorState, LoadingState } from '@/components/ui/states';
import {
  buildDaySnapshot,
  buildWeeklyAverages,
  entriesToMacros,
  groupEntriesByDate,
  groupWorkoutsByDate,
  mealCalorieBreakdown,
  MEAL_ORDER,
  // sumFoodQuantities, // Pro preview temporarily hidden
  weekDateKeys,
} from '@/features/diary/aggregations';
import { BarChart } from '@/features/diary/components/charts/bar-chart';
import { LineChart } from '@/features/diary/components/charts/line-chart';
import { MacroDonut } from '@/features/diary/components/charts/macro-donut';
import { ProgressRing } from '@/features/diary/components/charts/progress-ring';
import { calculateDailyBalance } from '@/features/diary/balance';
import { useFoodEntriesInRange, useWorkoutsInRange } from '@/features/diary/hooks';
import type { Goal } from '@/features/goals/types';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

type StatisticsViewProps = {
  dateKey: string;
  todayKey: string;
  locale: string;
  goal: Goal | null | undefined;
  onSelectDate: (key: string) => void;
};

type PeriodMode = 'day' | 'week';

export function StatisticsView({
  dateKey,
  todayKey,
  locale,
  goal,
  onSelectDate,
}: StatisticsViewProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [mode, setMode] = useState<PeriodMode>('day');
  const target = goal?.daily_calorie_target ?? 2000;

  const weekKeys = useMemo(() => weekDateKeys(dateKey), [dateKey]);
  const rangeStart = mode === 'day' ? dateKey : weekKeys[0]!;
  const rangeEnd = mode === 'day' ? dateKey : weekKeys[weekKeys.length - 1]!;

  const foodQuery = useFoodEntriesInRange(rangeStart, rangeEnd);
  const workoutQuery = useWorkoutsInRange(rangeStart, rangeEnd);

  const loading = foodQuery.isLoading || workoutQuery.isLoading;
  const error = foodQuery.error ?? workoutQuery.error;

  const dayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [locale],
  );
  const shortDayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );
  const rangeLabel =
    mode === 'day'
      ? dayFmt.format(parseDiaryDateKey(dateKey))
      : `${dayFmt.format(parseDiaryDateKey(weekKeys[0]!))} – ${dayFmt.format(parseDiaryDateKey(weekKeys[6]!))}`;

  const shift = (delta: number) => {
    if (mode === 'day') {
      const next = toDiaryDateKey(addDays(parseDiaryDateKey(dateKey), delta));
      if (delta > 0 && next > todayKey) return;
      onSelectDate(next);
      return;
    }
    const nextAnchor = toDiaryDateKey(addWeeks(parseDiaryDateKey(dateKey), delta));
    const nextWeek = weekDateKeys(nextAnchor);
    if (delta > 0 && nextWeek[0]! > todayKey) return;
    onSelectDate(nextAnchor > todayKey ? todayKey : nextAnchor);
  };

  const entriesByDate = useMemo(
    () => groupEntriesByDate(foodQuery.data ?? []),
    [foodQuery.data],
  );
  const workoutsByDate = useMemo(
    () => groupWorkoutsByDate(workoutQuery.data ?? []),
    [workoutQuery.data],
  );

  const dayEntries = entriesByDate.get(dateKey) ?? [];
  const dayWorkouts = workoutsByDate.get(dateKey) ?? [];
  const daySnapshot = buildDaySnapshot({
    dateKey,
    todayKey,
    entries: dayEntries,
    workouts: dayWorkouts,
    calorieTarget: target,
  });
  const dayBalance = calculateDailyBalance({
    consumed: daySnapshot.macros.calories,
    burned: daySnapshot.workoutCalories,
    target,
  });
  const mealBreakdown = mealCalorieBreakdown(dayEntries);
  // Temporarily unused while Pro food quantity preview is hidden.
  // const quantities = sumFoodQuantities(foodQuery.data ?? []);

  const weekly = buildWeeklyAverages({
    weekKeys,
    todayKey,
    entriesByDate,
    workoutsByDate,
    calorieTarget: target,
  });

  const weekBars = weekKeys.map((key) => {
    const dayEntriesForKey = entriesByDate.get(key) ?? [];
    const hasLogs = dayEntriesForKey.length > 0;
    return {
      key,
      label: shortDayFmt.format(parseDiaryDateKey(key)).replace(/\.$/, ''),
      value: key > todayKey || !hasLogs ? null : entriesToMacros(dayEntriesForKey).calories,
      muted: key === todayKey,
    };
  });

  const macroSeries = ['carbs', 'protein', 'fat'] as const;
  const weekMacroLines = macroSeries.map((key) => ({
    key: t(`diary.macros.${key}`),
    color:
      key === 'carbs'
        ? colors.macroCarbs
        : key === 'protein'
          ? colors.macroProtein
          : colors.macroFat,
    values: weekKeys.map((dayKey) => {
      if (dayKey > todayKey) return null;
      const list = entriesByDate.get(dayKey) ?? [];
      if (!list.length) return null;
      const macros = entriesToMacros(list);
      return key === 'carbs' ? macros.carbsG : key === 'protein' ? macros.proteinG : macros.fatG;
    }),
  }));

  const weekMealTotals = MEAL_ORDER.map((meal) => {
    let sum = 0;
    for (const key of weekKeys) {
      if (key > todayKey) continue;
      const list = entriesByDate.get(key) ?? [];
      sum += mealCalorieBreakdown(list)[meal];
    }
    return {
      key: meal,
      label: t(`meals.${meal}`),
      value: sum > 0 ? sum : null,
    };
  });

  return (
    <View className="gap-4">
      <View
        className="flex-row p-1"
        style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.lg }}
      >
        {(['day', 'week'] as PeriodMode[]).map((item) => {
          const selected = mode === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setMode(item)}
              className="flex-1 items-center py-2.5"
              style={{
                backgroundColor: selected ? colors.primary : 'transparent',
                borderRadius: radii.lg,
              }}
            >
              <Text
                variant="label"
                style={{ color: selected ? colors.textOnPrimary : colors.textSecondary }}
              >
                {t(`diary.stats.${item}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center justify-between">
        <ChromeIconButton
          label={t('common.goBack')}
          onPress={() => shift(-1)}
          icon={(color) => <ChevronLeft size={22} color={color} />}
        />
        <Text variant="bodyStrong" style={{ textAlign: 'center', flex: 1 }} numberOfLines={2}>
          {rangeLabel}
        </Text>
        <ChromeIconButton
          label={t('mealPlan.nextDay')}
          onPress={() => shift(1)}
          icon={(color) => <ChevronRight size={22} color={color} />}
        />
      </View>

      {dateKey === todayKey || (mode === 'week' && weekKeys.includes(todayKey)) ? (
        <Text variant="caption" tone="secondary">
          {t('diary.stats.inProgressNote')}
        </Text>
      ) : null}

      {loading ? <LoadingState /> : null}
      {error ? (
        <ErrorState
          title={t('diary.stats.loadError')}
          body={error instanceof Error ? error.message : t('diary.stats.retry')}
          onRetry={() => {
            void foodQuery.refetch();
            void workoutQuery.refetch();
          }}
        />
      ) : null}

      {!loading && !error && mode === 'day' ? (
        <>
          <Card className="items-center gap-3">
            <Text variant="label" tone="secondary">
              {t('diary.stats.calorieOverview')}
            </Text>
            <ProgressRing
              value={daySnapshot.macros.calories}
              max={Math.max(1, target)}
              centerPrimary={String(Math.round(daySnapshot.macros.calories))}
              centerSecondary={t('diary.rings.kcalConsumed')}
              color={colors.macroCalories}
            />
            <View className="w-full flex-row justify-between">
              <Stat label={t('diary.balance.target')} value={`${Math.round(target)}`} />
              <Stat
                label={
                  dayBalance.remaining < 0
                    ? t('diary.balance.exceeded')
                    : t('diary.balance.remainingShort')
                }
                value={`${Math.abs(Math.round(dayBalance.remaining))}`}
              />
              <Stat
                label={t('diary.balance.activity')}
                value={`${Math.round(daySnapshot.workoutCalories)}`}
              />
            </View>
            <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
              {t('diary.stats.energyBalanceNote', {
                intake: Math.round(daySnapshot.macros.calories),
                activity: Math.round(daySnapshot.workoutCalories),
              })}
            </Text>
          </Card>

          <Card className="gap-3">
            <Text variant="label" tone="secondary">
              {t('diary.stats.macroBreakdown')}
            </Text>
            <MacroDonut
              centerLabel={t('diary.rings.consumedShare')}
              emptyLabel={t('diary.rings.emptyMacros')}
              segments={[
                {
                  key: 'carbs',
                  label: t('diary.macros.carbs'),
                  value: daySnapshot.macros.carbsG,
                  color: colors.macroCarbs,
                },
                {
                  key: 'protein',
                  label: t('diary.macros.protein'),
                  value: daySnapshot.macros.proteinG,
                  color: colors.macroProtein,
                },
                {
                  key: 'fat',
                  label: t('diary.macros.fat'),
                  value: daySnapshot.macros.fatG,
                  color: colors.macroFat,
                },
              ]}
            />
          </Card>

          <Card className="gap-3">
            <Text variant="label" tone="secondary">
              {t('diary.stats.mealBreakdown')}
            </Text>
            <BarChart
              emptyLabel={t('diary.stats.noData')}
              items={MEAL_ORDER.map((meal) => ({
                key: meal,
                label: t(`meals.${meal}`),
                value: mealBreakdown[meal] > 0 ? mealBreakdown[meal] : null,
              }))}
            />
          </Card>

          <Card className="gap-2">
            <Text variant="label" tone="secondary">
              {t('diary.stats.foodConsumption')}
            </Text>
            <StatRow label={t('diary.stats.foodEntries')} value={String(daySnapshot.entryCount)} />
            <StatRow
              label={t('diary.stats.totalCalories')}
              value={`${Math.round(daySnapshot.macros.calories)} kcal`}
            />
          </Card>

          <Card className="gap-2">
            <Text variant="label" tone="secondary">
              {t('diary.stats.workoutSummary')}
            </Text>
            <StatRow
              label={t('diary.stats.workoutCount')}
              value={String(daySnapshot.workouts.length)}
            />
            <StatRow
              label={t('diary.stats.workoutDuration')}
              value={t('diary.workout.minutes', { value: daySnapshot.workoutMinutes })}
            />
            <StatRow
              label={t('diary.stats.workoutCalories')}
              value={
                daySnapshot.workoutCalories > 0
                  ? `${Math.round(daySnapshot.workoutCalories)} kcal`
                  : '—'
              }
            />
          </Card>

          {/* Temporarily hidden — Pro food quantity preview
          <ProFoodPreview quantities={quantities} />
          */}
        </>
      ) : null}

      {!loading && !error && mode === 'week' ? (
        <>
          <Card className="gap-3">
            <Text variant="label" tone="secondary">
              {t('diary.stats.weeklyCalories')}
            </Text>
            <BarChart
              items={weekBars}
              target={target}
              emptyLabel={t('diary.stats.noData')}
            />
          </Card>

          <Card className="gap-2">
            <Text variant="label" tone="secondary">
              {t('diary.stats.weeklyAverages')}
            </Text>
            <StatRow
              label={t('diary.stats.avgCalories')}
              value={weekly.avgCalories != null ? `${weekly.avgCalories} kcal` : '—'}
            />
            <StatRow label={t('diary.stats.avgTarget')} value={`${Math.round(target)} kcal`} />
            <StatRow
              label={t('diary.macros.protein')}
              value={weekly.avgProtein != null ? `${weekly.avgProtein} g` : '—'}
            />
            <StatRow
              label={t('diary.macros.carbs')}
              value={weekly.avgCarbs != null ? `${weekly.avgCarbs} g` : '—'}
            />
            <StatRow
              label={t('diary.macros.fat')}
              value={weekly.avgFat != null ? `${weekly.avgFat} g` : '—'}
            />
            <Text variant="caption" tone="secondary">
              {t('diary.stats.averageNote')}
            </Text>
          </Card>

          <Card className="gap-3">
            <Text variant="label" tone="secondary">
              {t('diary.stats.macroTrends')}
            </Text>
            <LineChart
              labels={weekBars.map((b) => b.label)}
              series={weekMacroLines}
              emptyLabel={t('diary.stats.noData')}
            />
          </Card>

          <Card className="gap-3">
            <Text variant="label" tone="secondary">
              {t('diary.stats.weeklyMeals')}
            </Text>
            <BarChart items={weekMealTotals} emptyLabel={t('diary.stats.noData')} />
          </Card>

          <Card className="gap-2">
            <Text variant="label" tone="secondary">
              {t('diary.stats.weeklyConsistency')}
            </Text>
            <StatRow label={t('diary.stats.daysWithFood')} value={String(weekly.daysWithFood)} />
            <StatRow label={t('diary.stats.daysOnTarget')} value={String(weekly.daysOnTarget)} />
            <StatRow label={t('diary.stats.workoutDays')} value={String(weekly.workoutDays)} />
            <StatRow
              label={t('diary.stats.workoutDuration')}
              value={t('diary.workout.minutes', { value: weekly.totalWorkoutMinutes })}
            />
          </Card>

          {/* Temporarily hidden — Pro food quantity preview
          <ProFoodPreview quantities={quantities} />
          */}
        </>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text variant="metric">{value}</Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="bodySmall" tone="secondary" className="flex-1">
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

/* Temporarily hidden — Pro food quantity preview
function ProFoodPreview({
  quantities,
}: {
  quantities: ReturnType<typeof sumFoodQuantities>;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <Card className="gap-2" style={{ borderColor: colors.primary, borderWidth: 1 }}>
      <Text variant="label" tone="brand">
        {t('diary.pro.badge')}
      </Text>
      <Text variant="headingSmall">{t('diary.pro.title')}</Text>
      <Text variant="bodySmall" tone="secondary">
        {t('diary.pro.body')}
      </Text>
      <StatRow label={t('diary.stats.foodEntries')} value={String(quantities.entryCount)} />
      <View
        className="gap-1 px-3 py-3"
        style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, opacity: 0.72 }}
      >
        <Text variant="caption" tone="secondary">
          {t('diary.pro.lockedGrams')}
        </Text>
        <Text variant="caption" tone="secondary">
          {t('diary.pro.lockedMl')}
        </Text>
        <Text variant="caption" tone="muted">
          {t('diary.pro.subscriptionMissing')}
        </Text>
      </View>
    </Card>
  );
}
*/
