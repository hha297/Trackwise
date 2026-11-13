import { addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useWeeklyEngagementSummary } from '@/features/engagement/hooks';
import { MetricTile, MetricTileRow } from '@/features/progress/components/metric-tile';
import { useAppLanguage } from '@/i18n';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

type WeeklySummaryCardProps = {
  todayKey?: string;
};

function formatLiters(ml: number, locale: string): string {
  const liters = ml / 1000;
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: liters >= 10 ? 0 : 1,
  }).format(liters)} L`;
}

/** Calendar-week engagement summary for Progress (Mon–Sun). */
export function WeeklySummaryCard({ todayKey = toDiaryDateKey() }: WeeklySummaryCardProps) {
  const { t } = useTranslation();
  const locale = useAppLanguage();
  const colors = useThemeColors();
  const [anchorKey, setAnchorKey] = useState(todayKey);
  const { data, isLoading, isError, refetch, weekStartKey, weekEndKey } =
    useWeeklyEngagementSummary(anchorKey);

  const rangeLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
    return `${fmt.format(parseDiaryDateKey(weekStartKey))} – ${fmt.format(parseDiaryDateKey(weekEndKey))}`;
  }, [locale, weekStartKey, weekEndKey]);

  const nextWeekStartsAfterToday =
    toDiaryDateKey(addWeeks(parseDiaryDateKey(weekStartKey), 1)) > todayKey;

  const shiftWeek = (delta: number) => {
    if (delta > 0 && nextWeekStartsAfterToday) return;
    const next = toDiaryDateKey(addWeeks(parseDiaryDateKey(anchorKey), delta));
    setAnchorKey(next > todayKey ? todayKey : next);
  };

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="headingSmall">{t('engagement.weekly.title')}</Text>
          <Text variant="bodySmall" tone="secondary">
            {t('engagement.weekly.subtitle')}
          </Text>
        </View>
        <View style={styles.nav}>
          <Pressable
            onPress={() => shiftWeek(-1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('engagement.weekly.prevWeek')}
            style={styles.navBtn}
          >
            <ChevronLeft size={20} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => shiftWeek(1)}
            hitSlop={8}
            disabled={nextWeekStartsAfterToday}
            accessibilityRole="button"
            accessibilityLabel={t('engagement.weekly.nextWeek')}
            style={[styles.navBtn, nextWeekStartsAfterToday && styles.navDisabled]}
          >
            <ChevronRight
              size={20}
              color={nextWeekStartsAfterToday ? colors.textMuted : colors.textPrimary}
            />
          </Pressable>
        </View>
      </View>

      <Text variant="caption" tone="muted" style={styles.range}>
        {rangeLabel}
      </Text>

      {isLoading && !data ? (
        <Text variant="bodySmall" tone="secondary">
          {t('engagement.weekly.loading')}
        </Text>
      ) : null}

      {isError && !data ? (
        <View style={styles.errorBlock}>
          <Text variant="bodySmall" tone="secondary">
            {t('engagement.weekly.loadError')}
          </Text>
          <Text
            variant="bodyStrong"
            tone="brand"
            onPress={() => {
              void refetch();
            }}
            accessibilityRole="button"
          >
            {t('engagement.weekly.retry')}
          </Text>
        </View>
      ) : null}

      {data ? (
        <View style={styles.grid}>
          <MetricTileRow>
            <MetricTile
              label={t('engagement.weekly.nutritionDays')}
              value={`${data.nutritionLoggingDays}/7`}
              hint={t('engagement.weekly.daysLoggedHint')}
            />
            <MetricTile
              label={t('engagement.weekly.hydrationDays')}
              value={`${data.hydrationLoggingDays}/7`}
              hint={
                data.totalHydrationMl > 0
                  ? t('engagement.weekly.hydrationTotal', {
                      value: formatLiters(data.totalHydrationMl, locale),
                    })
                  : t('engagement.weekly.noHydration')
              }
            />
          </MetricTileRow>
          <MetricTileRow>
            <MetricTile
              label={t('engagement.weekly.workoutDays')}
              value={`${data.workoutDays}/7`}
              hint={t('engagement.weekly.sessionsHint', {
                count: data.completedWorkoutSessions,
              })}
            />
            <MetricTile
              label={t('engagement.weekly.avgCalories')}
              value={data.avgCalories != null ? String(data.avgCalories) : '—'}
              hint={
                data.avgProteinG != null
                  ? t('engagement.weekly.avgProteinHint', { value: data.avgProteinG })
                  : t('engagement.weekly.noNutritionAvg')
              }
            />
          </MetricTileRow>
          {data.hydrationTargetProgress != null ? (
            <Text variant="caption" tone="muted">
              {t('engagement.weekly.hydrationProgress', {
                percent: Math.round(data.hydrationTargetProgress * 100),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  headerText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  navBtn: {
    padding: spacing[1],
  },
  navDisabled: {
    opacity: 0.35,
  },
  range: {
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  grid: {
    gap: spacing[2],
  },
  errorBlock: {
    gap: spacing[2],
  },
});
