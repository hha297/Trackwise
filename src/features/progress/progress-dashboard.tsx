import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useFoodEntriesInRange, useWorkoutsInRange } from '@/features/diary/hooks';
import { ConsistencySection } from '@/features/engagement/consistency-section';
import { useActiveGoal, useProfile } from '@/features/goals/hooks';
import { useHydrationInRange } from '@/features/hydration/hooks';
import { useBodyMeasurements } from '@/features/measurements/hooks';
import { buildActivityHistoryDays } from '@/features/progress/activity-history';
import {
  buildNutritionTrends,
  buildProgressOverview,
  buildWorkoutTrends,
} from '@/features/progress/aggregations';
import { BodyProgressSection } from '@/features/progress/components/body-progress-section';
import { NutritionTrendsSection } from '@/features/progress/components/nutrition-trends-section';
import { OverviewSection } from '@/features/progress/components/overview-section';
import { PeriodControl } from '@/features/progress/components/period-control';
import { WorkoutProgressSection } from '@/features/progress/components/workout-progress-section';
import { progressRange } from '@/features/progress/period';
import type { ProgressPeriod } from '@/features/progress/types';
import { useAppLanguage } from '@/i18n';
import { layout, spacing } from '@/theme';
import { toDiaryDateKey } from '@/utils/date';

/**
 * Progress hierarchy:
 * Overview → Consistency (incl. collapsible category activity) → Nutrition → Workout → Body.
 */
export function ProgressDashboard() {
  const { t } = useTranslation();
  const locale = useAppLanguage();
  const [period, setPeriod] = useState<ProgressPeriod>(30);
  const todayKey = toDiaryDateKey();
  const range = useMemo(() => progressRange(period, todayKey), [period, todayKey]);

  const goal = useActiveGoal();
  const profile = useProfile();
  const foodQuery = useFoodEntriesInRange(range.startKey, range.endKey);
  const workoutQuery = useWorkoutsInRange(range.startKey, range.endKey);
  const hydrationQuery = useHydrationInRange(range.startKey, range.endKey);
  const measurementsQuery = useBodyMeasurements();

  const loading = foodQuery.isLoading || workoutQuery.isLoading || goal.isLoading;
  const error = foodQuery.error ?? workoutQuery.error ?? goal.error;

  const overview = useMemo(
    () =>
      buildProgressOverview({
        dayKeys: range.dayKeys,
        todayKey: range.todayKey,
        entries: foodQuery.data ?? [],
        workouts: workoutQuery.data ?? [],
        measurements: measurementsQuery.data ?? [],
        goal: goal.data,
      }),
    [
      range.dayKeys,
      range.todayKey,
      foodQuery.data,
      workoutQuery.data,
      measurementsQuery.data,
      goal.data,
    ],
  );

  const nutrition = useMemo(
    () =>
      buildNutritionTrends({
        period,
        dayKeys: range.dayKeys,
        todayKey: range.todayKey,
        entries: foodQuery.data ?? [],
        locale,
      }),
    [period, range.dayKeys, range.todayKey, foodQuery.data, locale],
  );

  const workouts = useMemo(
    () =>
      buildWorkoutTrends({
        period,
        dayKeys: range.dayKeys,
        todayKey: range.todayKey,
        workouts: workoutQuery.data ?? [],
        locale,
      }),
    [period, range.dayKeys, range.todayKey, workoutQuery.data, locale],
  );

  const activityDays = useMemo(
    () =>
      buildActivityHistoryDays({
        startKey: range.startKey,
        endKey: range.endKey,
        foodEntries: foodQuery.data ?? [],
        hydrationEntries: hydrationQuery.data?.entries ?? [],
        workouts: workoutQuery.data ?? [],
      }),
    [range.startKey, range.endKey, foodQuery.data, hydrationQuery.data, workoutQuery.data],
  );

  const periodLabels = {
    7: t('progress.period.d7'),
    30: t('progress.period.d30'),
    90: t('progress.period.d90'),
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="headingLarge">{t('progress.title')}</Text>
        <Text variant="bodySmall" tone="secondary">
          {t('progress.subtitle')}
        </Text>
      </View>

      <View style={styles.periodBlock}>
        <PeriodControl value={period} labels={periodLabels} onChange={setPeriod} />
        <Text variant="caption" tone="muted">
          {t('progress.period.appliesTo')}
        </Text>
      </View>

      {loading ? <LoadingState /> : null}

      {error ? (
        <ErrorState
          title={t('progress.loadError')}
          body={error instanceof Error ? error.message : t('progress.retry')}
          onRetry={() => {
            void foodQuery.refetch();
            void workoutQuery.refetch();
            void hydrationQuery.refetch();
            void measurementsQuery.refetch();
            void goal.refetch();
          }}
        />
      ) : null}

      {!loading && !error ? (
        <View style={styles.sections}>
          <OverviewSection overview={overview} goal={goal.data} period={period} />
          <ConsistencySection
            todayKey={todayKey}
            period={period}
            startKey={range.startKey}
            endKey={range.endKey}
            activityDays={activityDays}
          />
          <NutritionTrendsSection
            series={nutrition}
            avgCalories={overview.avgCalories}
            avgProtein={overview.avgProtein}
            avgCarbs={overview.avgCarbs}
            avgFat={overview.avgFat}
            goal={goal.data}
          />
          <WorkoutProgressSection summary={workouts} />
          <BodyProgressSection
            measurements={measurementsQuery.data ?? []}
            startKey={range.startKey}
            endKey={range.endKey}
            locale={locale}
            profile={profile.data}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: layout.sectionGap + spacing[1],
  },
  header: {
    gap: spacing[1],
    paddingBottom: spacing[1],
  },
  periodBlock: {
    gap: spacing[2],
  },
  sections: {
    gap: layout.sectionGap + spacing[1],
  },
});
