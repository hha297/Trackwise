import { Flame } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import {
  consistencyWeeksForPeriod,
  countActiveDaysInRange,
  unionActiveDayKeys,
} from '@/features/engagement/activity-days';
import { ConsistencyBreakdown } from '@/features/engagement/consistency-breakdown';
import { ConsistencyHeatmap } from '@/features/engagement/consistency-heatmap';
import { ConsistencyMilestones } from '@/features/engagement/consistency-milestones';
import { useEngagementStreaks } from '@/features/engagement/hooks';
import type { ActivityHistoryDay } from '@/features/progress/activity-history';
import type { ProgressPeriod } from '@/features/progress/types';
import { useAppLanguage } from '@/i18n';
import { radii, spacing, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { toDiaryDateKey } from '@/utils/date';

type ConsistencySectionProps = {
  todayKey?: string;
  /** Progress period — drives heatmap window, active-day count, and breakdown. */
  period: ProgressPeriod;
  startKey: string;
  endKey: string;
  /** Period activity records for collapsible By category details. */
  activityDays?: ActivityHistoryDay[];
};

/**
 * Progress Consistency — habit regularity (streaks + period activity).
 * Streaks are all-time/current semantics; activity views follow `period`.
 */
export function ConsistencySection({
  todayKey = toDiaryDateKey(),
  period,
  startKey,
  endKey,
  activityDays = [],
}: ConsistencySectionProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const locale = useAppLanguage();
  const { data, isLoading, isError, refetch } = useEngagementStreaks(todayKey);
  const streakAccent = colors.warning;
  const weeks = consistencyWeeksForPeriod(period);

  if (isLoading && !data) {
    return (
      <Card>
        <Text variant="headingSmall">{t('engagement.consistency.screenTitle')}</Text>
        <LoadingState />
      </Card>
    );
  }

  if (isError && !data) {
    return (
      <Card>
        <ErrorState
          title={t('engagement.streaks.loadError')}
          body={t('engagement.streaks.retry')}
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }

  if (!data) return null;

  const overall = data.consistency.overall;
  const empty = overall.longest === 0 && !overall.alive;
  const unionKeys = unionActiveDayKeys(
    data.nutritionKeys,
    data.hydrationKeys,
    data.workoutCompletedKeys,
  );
  const activeInPeriod = countActiveDaysInRange(unionKeys, startKey, endKey);

  return (
    <Card
      style={styles.card}
      accessibilityLabel={t('engagement.consistency.screenTitle')}
    >
      <View style={{ gap: 2 }}>
        <Text variant="headingSmall">{t('engagement.consistency.screenTitle')}</Text>
        <Text variant="caption" tone="muted">
          {t('engagement.consistency.sectionHint')}
        </Text>
      </View>

      <View style={styles.heroRow}>
        <View style={[styles.flameWrap, { backgroundColor: withAlpha(streakAccent, 0.18) }]}>
          <Flame size={22} color={streakAccent} fill={streakAccent} />
        </View>
        <View style={styles.heroCopy}>
          <Text variant="caption" style={{ color: streakAccent }}>
            {t('engagement.consistency.currentStreak')}
          </Text>
          <Text variant="headingLarge" numberOfLines={1}>
            {t('engagement.consistency.daysCount', { count: overall.current })}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {empty
              ? t('engagement.streaks.empty')
              : overall.alive
                ? t('engagement.consistency.keepBuilding')
                : t('engagement.consistency.startAgain')}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {t('engagement.consistency.bestStreak')}
          </Text>
          <Text variant="bodyStrong" numberOfLines={1}>
            {t('engagement.consistency.daysCount', { count: overall.longest })}
          </Text>
          <Text variant="fine" tone="muted" numberOfLines={1}>
            {t('engagement.consistency.bestStreakHint')}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {t('engagement.consistency.activeInPeriod')}
          </Text>
          <Text variant="bodyStrong" numberOfLines={1}>
            {t('engagement.consistency.daysCount', { count: activeInPeriod })}
          </Text>
          <Text variant="fine" tone="muted" numberOfLines={1}>
            {t('engagement.consistency.activeInPeriodHint', { count: period })}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <ConsistencyHeatmap
        todayKey={todayKey}
        flagsByDay={data.flagsByDay}
        locale={locale}
        weeks={weeks}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <ConsistencyBreakdown
        todayKey={todayKey}
        nutritionKeys={data.nutritionKeys}
        hydrationKeys={data.hydrationKeys}
        workoutCompletedKeys={data.workoutCompletedKeys}
        windowDays={period}
        locale={locale}
        activityDays={activityDays}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <ConsistencyMilestones bestDays={overall.longest} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[4],
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  flameWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
