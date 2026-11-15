import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import type { ProgressOverview } from '@/features/progress/aggregations';
import { MetricTile, MetricTileRow } from '@/features/progress/components/metric-tile';
import type { Goal } from '@/features/goals/types';
import type { ProgressPeriod } from '@/features/progress/types';
import { spacing } from '@/theme';

type OverviewSectionProps = {
  overview: ProgressOverview;
  goal: Goal | null | undefined;
  period: ProgressPeriod;
};

function formatSigned(value: number, digits = 1): string {
  const abs = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return abs;
}

/**
 * Compact period snapshot — avoids duplicating Nutrition / Workout / Body detail tiles.
 */
export function OverviewSection({ overview, goal, period }: OverviewSectionProps) {
  const { t } = useTranslation();
  const hasAny =
    overview.daysWithFood > 0 ||
    overview.workoutSessions > 0 ||
    overview.weightChangeKg != null ||
    overview.bodyFatChangePct != null;

  if (!hasAny) {
    return (
      <Card>
        <EmptyState title={t('progress.empty.title')} body={t('progress.empty.body')} />
      </Card>
    );
  }

  const calorieHint =
    overview.avgCalories != null && goal?.daily_calorie_target != null
      ? t('progress.overview.vsGoal', { goal: Math.round(goal.daily_calorie_target) })
      : null;

  return (
    <Card style={styles.card}>
      <View style={{ gap: 2 }}>
        <Text variant="headingSmall">{t('progress.overview.title')}</Text>
        <Text variant="caption" tone="muted">
          {t('progress.overview.periodHint', { count: period })}
        </Text>
      </View>

      <View style={styles.grid}>
        <MetricTileRow>
          <MetricTile
            label={t('progress.overview.avgCalories')}
            value={overview.avgCalories != null ? `${overview.avgCalories}` : '—'}
            hint={calorieHint}
          />
          <MetricTile
            label={t('progress.overview.sessions')}
            value={String(overview.workoutSessions)}
            hint={t('progress.overview.workoutDays', { count: overview.workoutDays })}
          />
        </MetricTileRow>
        <MetricTileRow>
          <MetricTile
            label={t('progress.overview.weightChange')}
            value={
              overview.weightChangeKg != null
                ? `${formatSigned(overview.weightChangeKg)} kg`
                : '—'
            }
            hint={
              overview.weightChangeKg == null ? t('progress.overview.needTwoPoints') : null
            }
          />
          <MetricTile
            label={t('progress.overview.adherenceShort')}
            value={
              overview.goalAdherencePct != null ? `${overview.goalAdherencePct}%` : '—'
            }
            hint={
              overview.goalAdherencePct != null
                ? t('progress.overview.adherenceHint', {
                    onTarget: overview.daysOnTarget,
                    days: overview.completedFoodDays,
                  })
                : goal?.daily_calorie_target != null
                  ? t('progress.overview.adherenceUnavailable')
                  : null
            }
          />
        </MetricTileRow>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[3],
  },
  grid: {
    gap: spacing[2],
  },
});
