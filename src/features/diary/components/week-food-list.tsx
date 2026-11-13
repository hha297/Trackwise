import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import {
  entriesToMacros,
  groupEntriesByDate,
  groupWorkoutsByDate,
  weekDateKeys,
} from '@/features/diary/aggregations';
import { useFoodEntriesInRange, useWorkoutsInRange } from '@/features/diary/hooks';
import type { FoodEntry } from '@/features/food/types';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey } from '@/utils/date';

type WeekFoodListProps = {
  dateKey: string;
  todayKey: string;
  locale: string;
  openKey: string | null;
  onOpenKeyChange: (key: string | null) => void;
};

function entryAmountLabel(entry: FoodEntry) {
  if (entry.amount != null && entry.amount_unit) {
    const unit =
      entry.amount_unit === 'g'
        ? 'g'
        : entry.amount_unit === 'ml'
          ? 'ml'
          : entry.serving_label;
    return `${entry.amount} ${unit}`;
  }
  return `${entry.quantity} × ${entry.serving_label}`;
}

export function WeekFoodList({
  dateKey,
  todayKey,
  locale,
  openKey,
  onOpenKeyChange,
}: WeekFoodListProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const weekKeys = weekDateKeys(dateKey);
  const weekStart = weekKeys[0]!;
  const weekEnd = weekKeys[weekKeys.length - 1]!;
  const weekFood = useFoodEntriesInRange(weekStart, weekEnd);
  const weekWorkouts = useWorkoutsInRange(weekStart, weekEnd);
  const entries = useMemo(() => weekFood.data ?? [], [weekFood.data]);
  const workouts = useMemo(() => weekWorkouts.data ?? [], [weekWorkouts.data]);
  const byDate = useMemo(() => groupEntriesByDate(entries), [entries]);
  const workoutsByDate = useMemo(() => groupWorkoutsByDate(workouts), [workouts]);
  const lastWeekStart = useRef(weekStart);

  useEffect(() => {
    if (lastWeekStart.current === weekStart) return;
    lastWeekStart.current = weekStart;
    onOpenKeyChange(weekKeys.includes(todayKey) ? todayKey : weekKeys[0]!);
  }, [weekStart, weekKeys, todayKey, onOpenKeyChange]);

  const weekdayLong = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'long' }),
    [locale],
  );
  const dayMonth = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
    [locale],
  );

  const weekTotals = entriesToMacros(entries);
  const daysLogged = weekKeys.filter(
    (key) => key <= todayKey && (byDate.get(key)?.length ?? 0) > 0,
  ).length;
  const daysElapsed = Math.max(1, weekKeys.filter((key) => key <= todayKey).length);
  const weekBurned = workouts.reduce(
    (sum, w) => sum + Number(w.estimated_calories ?? 0),
    0,
  );
  const workoutSessions = workouts.length;
  const avgDailyKcal = Math.round(weekTotals.calories / daysElapsed);
  const netKcal = Math.round(weekTotals.calories - weekBurned);

  const toggleDay = (key: string) => {
    onOpenKeyChange(openKey === key ? null : key);
  };

  return (
    <Card className="gap-3">
      <Text variant="headingSmall">{t('diary.weekFood.heading')}</Text>

      {/* Compact summary — flat, no nested “card in card”. */}
      <View className="gap-2.5">
        <View className="flex-row gap-2">
          <Metric
            label={t('diary.weekFood.summaryChipEaten')}
            value={Math.round(weekTotals.calories)}
          />
          <Metric label={t('diary.weekFood.summaryChipAvg')} value={avgDailyKcal} />
          <Metric
            label={t('diary.weekFood.summaryChipBurned')}
            value={Math.round(weekBurned)}
          />
          <Metric label={t('diary.weekFood.summaryChipNet')} value={netKcal} />
        </View>

        <View className="flex-row items-center gap-3">
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {t('diary.weekFood.summaryLoggedLabel')}
          </Text>
          <View className="min-w-0 flex-1 flex-row gap-1">
            {weekKeys.map((key) => {
              const isFuture = key > todayKey;
              const logged = !isFuture && (byDate.get(key)?.length ?? 0) > 0;
              return (
                <View
                  key={`log-${key}`}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: logged ? colors.primary : colors.border,
                    opacity: isFuture ? 0.35 : 1,
                  }}
                />
              );
            })}
          </View>
          <Text variant="caption" tone="brand" numberOfLines={1}>
            {t('diary.weekFood.summaryLoggedCount', {
              logged: daysLogged,
              total: daysElapsed,
            })}
          </Text>
        </View>

        <Text variant="caption" tone="muted" numberOfLines={1}>
          {t('diary.weekFood.summaryMacros', {
            carbs: Math.round(weekTotals.carbsG),
            protein: Math.round(weekTotals.proteinG),
            fat: Math.round(weekTotals.fatG),
          })}
          {workoutSessions > 0
            ? ` · ${t('diary.weekFood.summaryActivity', {
                sessions: workoutSessions,
                kcal: Math.round(weekBurned),
              })}`
            : ''}
        </Text>
      </View>

      <View className="gap-2">
        {weekKeys.map((key) => {
          const dayEntries = byDate.get(key) ?? [];
          const totals = entriesToMacros(dayEntries);
          const isFuture = key > todayKey;
          const open = openKey === key;
          const title = `${weekdayLong.format(parseDiaryDateKey(key))} · ${dayMonth.format(parseDiaryDateKey(key))}`;
          const dayBurned = (workoutsByDate.get(key) ?? []).reduce(
            (sum, w) => sum + Number(w.estimated_calories ?? 0),
            0,
          );

          return (
            <View
              key={key}
              style={{
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => toggleDay(key)}
                className="flex-row items-center gap-2 px-3 py-3"
              >
                {open ? (
                  <ChevronDown size={16} color={colors.textMuted} />
                ) : (
                  <ChevronRight size={16} color={colors.textMuted} />
                )}
                <Text variant="bodyStrong" className="min-w-0 flex-1" numberOfLines={1}>
                  {title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {isFuture
                    ? '—'
                    : t('diary.meals.kcal', { value: Math.round(totals.calories) })}
                </Text>
              </Pressable>

              {open ? (
                <View
                  className="gap-2 border-t px-3 pb-3 pt-2.5"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  {isFuture ? (
                    <View className="items-center py-4">
                      <Text variant="bodySmall" tone="muted" style={{ textAlign: 'center' }}>
                        {t('diary.weekFood.future')}
                      </Text>
                    </View>
                  ) : dayEntries.length === 0 ? (
                    <View className="items-center py-4">
                      <Text variant="bodySmall" tone="muted" style={{ textAlign: 'center' }}>
                        {t('diary.weekFood.emptyDay')}
                      </Text>
                    </View>
                  ) : (
                    dayEntries.map((entry) => (
                      <View
                        key={entry.id}
                        className="flex-row items-start justify-between gap-3 py-1.5"
                      >
                        <View className="min-w-0 flex-1 gap-0.5">
                          <Text variant="bodyStrong" numberOfLines={1}>
                            {entry.food_name}
                          </Text>
                          <Text variant="caption" tone="secondary" numberOfLines={1}>
                            {t(`meals.${entry.meal_type}`)} · {entryAmountLabel(entry)}
                          </Text>
                        </View>
                        <Text variant="bodyStrong" tone="brand">
                          {Math.round(entry.calories)}
                        </Text>
                      </View>
                    ))
                  )}
                  {!isFuture && dayBurned > 0 ? (
                    <Text variant="caption" tone="secondary">
                      {t('diary.weekFood.dayActivity', {
                        value: Math.round(dayBurned),
                      })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-0 flex-1 items-center gap-0.5">
      <Text variant="fine" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
