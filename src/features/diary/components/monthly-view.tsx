import { addDays, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ErrorState, LoadingState } from '@/components/ui/states';
import {
  buildDaySnapshot,
  buildMonthlySummary,
  groupEntriesByDate,
  groupWorkoutsByDate,
  monthDateKeys,
  shiftMonthKey,
  toMonthKey,
} from '@/features/diary/aggregations';
import type { DayCalorieStatus } from '@/features/diary/goal-status';
import { useFoodEntriesInRange, useWorkoutsInRange } from '@/features/diary/hooks';
import type { Goal } from '@/features/goals/types';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey } from '@/utils/date';

type MonthlyViewProps = {
  dateKey: string;
  todayKey: string;
  locale: string;
  goal: Goal | null | undefined;
  onSelectDate: (key: string) => void;
  onOpenDiary: (key: string) => void;
};

export function MonthlyView({
  dateKey,
  todayKey,
  locale,
  goal,
  onSelectDate,
  onOpenDiary,
}: MonthlyViewProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const monthKey = toMonthKey(dateKey);
  const keys = useMemo(() => monthDateKeys(monthKey), [monthKey]);
  const startKey = keys[0]!;
  const endKey = keys[keys.length - 1]!;
  const target = goal?.daily_calorie_target ?? 2000;

  const foodQuery = useFoodEntriesInRange(startKey, endKey);
  const workoutQuery = useWorkoutsInRange(startKey, endKey);
  const loading = foodQuery.isLoading || workoutQuery.isLoading;
  const error = foodQuery.error ?? workoutQuery.error;

  const entriesByDate = useMemo(
    () => groupEntriesByDate(foodQuery.data ?? []),
    [foodQuery.data],
  );
  const workoutsByDate = useMemo(
    () => groupWorkoutsByDate(workoutQuery.data ?? []),
    [workoutQuery.data],
  );

  const summary = useMemo(
    () =>
      buildMonthlySummary({
        monthKeys: keys,
        todayKey,
        entriesByDate,
        workoutsByDate,
        calorieTarget: target,
      }),
    [keys, todayKey, entriesByDate, workoutsByDate, target],
  );

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        parseDiaryDateKey(`${monthKey}-01`),
      ),
    [locale, monthKey],
  );

  const weekdayLabels = useMemo(() => {
    const start = parseDiaryDateKey('2026-10-26'); // Monday
    return Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(addDays(start, i)),
    );
  }, [locale]);

  const leadingBlanks = (() => {
    const dow = getDay(parseDiaryDateKey(startKey)); // 0 Sun … 6 Sat
    return dow === 0 ? 6 : dow - 1; // Monday-first
  })();

  const statusColor = (status: DayCalorieStatus): string => {
    switch (status) {
      case 'achieved':
        return colors.primary;
      case 'below':
        return colors.warning;
      case 'above':
        return colors.error;
      case 'in_progress':
        return colors.primaryMuted;
      default:
        return colors.surfaceMuted;
    }
  };

  const selectedSnapshot = buildDaySnapshot({
    dateKey,
    todayKey,
    entries: entriesByDate.get(dateKey) ?? [],
    workouts: workoutsByDate.get(dateKey) ?? [],
    calorieTarget: target,
  });

  const canGoNext = shiftMonthKey(monthKey, 1) <= toMonthKey(todayKey);

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <ChromeIconButton
          label={t('common.goBack')}
          onPress={() => onSelectDate(`${shiftMonthKey(monthKey, -1)}-01`)}
          icon={(color) => <ChevronLeft size={22} color={color} />}
        />
        <Text variant="headingSmall">{monthTitle}</Text>
        <ChromeIconButton
          label={t('mealPlan.nextDay')}
          disabled={!canGoNext}
          onPress={() => {
            if (!canGoNext) return;
            const next = `${shiftMonthKey(monthKey, 1)}-01`;
            onSelectDate(next > todayKey ? todayKey : next);
          }}
          icon={(color) => <ChevronRight size={22} color={color} />}
        />
      </View>

      {loading ? <LoadingState /> : null}
      {error ? (
        <ErrorState
          title={t('diary.monthly.loadError')}
          body={error instanceof Error ? error.message : t('diary.stats.retry')}
          onRetry={() => {
            void foodQuery.refetch();
            void workoutQuery.refetch();
          }}
        />
      ) : null}

      {!loading && !error ? (
        <>
          <Card className="gap-3">
            <View className="flex-row">
              {weekdayLabels.map((label, index) => (
                <View key={`${label}-${index}`} className="flex-1 items-center py-1">
                  <Text variant="caption" tone="secondary">
                    {label}
                  </Text>
                </View>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {Array.from({ length: leadingBlanks }).map((_, index) => (
                <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />
              ))}
              {keys.map((key) => {
                const snapshot = buildDaySnapshot({
                  dateKey: key,
                  todayKey,
                  entries: entriesByDate.get(key) ?? [],
                  workouts: workoutsByDate.get(key) ?? [],
                  calorieTarget: target,
                });
                const selected = key === dateKey;
                const isToday = key === todayKey;
                const dayNum = String(parseDiaryDateKey(key).getDate());
                const bg = statusColor(snapshot.status);
                const isNeutral =
                  snapshot.status === 'no_data' ||
                  snapshot.status === 'future' ||
                  snapshot.status === 'in_progress';

                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${dayNum}, ${t(`diary.monthly.status.${snapshot.status}`)}`}
                    onPress={() => onSelectDate(key)}
                    style={{
                      width: `${100 / 7}%`,
                      aspectRatio: 1,
                      padding: 3,
                    }}
                  >
                    <View
                      className="flex-1 items-center justify-center"
                      style={{
                        borderRadius: radii.md,
                        backgroundColor: bg,
                        borderWidth: selected || isToday ? 2 : 0,
                        borderColor: selected ? colors.textPrimary : colors.primary,
                      }}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: isNeutral ? colors.textPrimary : colors.textOnPrimary,
                          fontWeight: selected ? '700' : '500',
                        }}
                      >
                        {dayNum}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View className="flex-row flex-wrap gap-x-3 gap-y-1">
              {(
                [
                  ['achieved', colors.primary],
                  ['below', colors.warning],
                  ['above', colors.error],
                  ['no_data', colors.surfaceMuted],
                ] as const
              ).map(([status, color]) => (
                <View key={status} className="flex-row items-center gap-1.5">
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
                  />
                  <Text variant="caption" tone="secondary">
                    {t(`diary.monthly.status.${status}`)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          <Card className="gap-3">
            <Text variant="headingSmall">{t('diary.monthly.daySummary')}</Text>
            <Text variant="caption" tone="secondary">
              {new Intl.DateTimeFormat(locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(parseDiaryDateKey(dateKey))}
            </Text>
            <StatRow
              label={t('diary.stats.totalCalories')}
              value={
                selectedSnapshot.hasFoodLogs
                  ? `${Math.round(selectedSnapshot.macros.calories)} kcal`
                  : '—'
              }
            />
            <StatRow
              label={t('diary.balance.target')}
              value={`${Math.round(target)} kcal`}
            />
            <StatRow
              label={t('diary.monthly.dayStatus')}
              value={t(`diary.monthly.status.${selectedSnapshot.status}`)}
            />
            <Button
              label={t('diary.monthly.openDiary')}
              onPress={() => onOpenDiary(dateKey)}
            />
          </Card>

          <Card className="gap-2">
            <Text variant="headingSmall">{t('diary.monthly.summary')}</Text>
            {toMonthKey(todayKey) === monthKey ? (
              <Text variant="caption" tone="secondary">
                {t('diary.monthly.inProgressNote', {
                  elapsed: summary.elapsedDays,
                  total: keys.length,
                })}
              </Text>
            ) : null}
            <StatRow
              label={t('diary.monthly.totalConsumed')}
              value={`${summary.totalConsumed} kcal`}
            />
            <StatRow
              label={t('diary.monthly.totalPlanned')}
              value={`${summary.totalPlanned} kcal`}
            />
            <Text variant="caption" tone="muted">
              {t('diary.monthly.plannedNote')}
            </Text>
            <StatRow
              label={t('diary.monthly.avgConsumed')}
              value={
                summary.averageConsumed != null ? `${summary.averageConsumed} kcal` : '—'
              }
            />
            <StatRow
              label={t('diary.monthly.daysAchieved')}
              value={String(summary.daysAchieved)}
            />
            <StatRow label={t('diary.monthly.daysBelow')} value={String(summary.daysBelow)} />
            <StatRow label={t('diary.monthly.daysAbove')} value={String(summary.daysAbove)} />
            <StatRow
              label={t('diary.stats.daysWithFood')}
              value={String(summary.daysWithFood)}
            />
            <StatRow
              label={t('diary.stats.workoutDays')}
              value={String(summary.workoutDays)}
            />
            <StatRow
              label={t('diary.stats.workoutDuration')}
              value={t('diary.workout.minutes', { value: summary.totalWorkoutMinutes })}
            />
            {goal?.goal_type === 'lose_weight' && goal.weekly_change_kg != null ? (
              <Text variant="caption" tone="secondary">
                {t('diary.monthly.deficitNote')}
              </Text>
            ) : null}
          </Card>
        </>
      ) : null}
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
