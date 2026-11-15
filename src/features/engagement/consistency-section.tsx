import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

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

const flameGif = require('../../../assets/animations/flame.gif');
const flameZeroGif = require('../../../assets/animations/flame-zero.gif');

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
    <View style={styles.stack} accessibilityLabel={t('engagement.consistency.screenTitle')}>
      <Card style={styles.poster}>
        <Text variant="headingSmall" style={styles.centerText}>
          {t('engagement.consistency.screenTitle')}
        </Text>
        <StreakFlame lit={overall.current >= 1} />
        <View style={styles.posterCopy}>
          <Text variant="display" numberOfLines={1} style={styles.centerText}>
            {t('engagement.consistency.daysCount', { count: overall.current })}
          </Text>
          <Text variant="caption" tone="muted" style={styles.centerText}>
            {t('engagement.consistency.currentStreak')}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2} style={styles.centerText}>
            {empty
              ? t('engagement.streaks.empty')
              : overall.alive
                ? t('engagement.consistency.keepBuilding')
                : t('engagement.consistency.startAgain')}
          </Text>
        </View>

        <View style={[styles.statsRow, { backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.stat}>
            <Text variant="caption" tone="muted" numberOfLines={1} style={styles.centerText}>
              {t('engagement.consistency.bestStreak')}
            </Text>
            <Text variant="headingSmall" numberOfLines={1} style={styles.centerText}>
              {t('engagement.consistency.daysCount', { count: overall.longest })}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text variant="caption" tone="muted" numberOfLines={1} style={styles.centerText}>
              {t('engagement.consistency.activeInPeriod')}
            </Text>
            <Text variant="headingSmall" numberOfLines={1} style={styles.centerText}>
              {t('engagement.consistency.daysCount', { count: activeInPeriod })}
            </Text>
          </View>
        </View>
        <Text variant="caption" tone="muted" style={styles.centerText}>
          {t('engagement.consistency.sectionHint')}
        </Text>
      </Card>

      <Card style={styles.card}>
        <ConsistencyHeatmap
          todayKey={todayKey}
          flagsByDay={data.flagsByDay}
          locale={locale}
          weeks={weeks}
        />
      </Card>

      <Card style={styles.card}>
        <ConsistencyBreakdown
          todayKey={todayKey}
          nutritionKeys={data.nutritionKeys}
          hydrationKeys={data.hydrationKeys}
          workoutCompletedKeys={data.workoutCompletedKeys}
          windowDays={period}
          locale={locale}
          activityDays={activityDays}
        />
      </Card>

      <Card style={styles.card}>
        <ConsistencyMilestones bestDays={overall.longest} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing[4],
  },
  card: {
    gap: spacing[4],
  },
  poster: {
    alignItems: 'center',
    gap: spacing[3],
  },
  posterCopy: {
    alignItems: 'center',
    gap: 2,
  },
  centerText: {
    textAlign: 'center',
  },
  flameWell: {
    width: 112,
    height: 112,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flame: {
    width: 80,
    height: 80,
  },
  statsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});

function StreakFlame({ lit }: { lit: boolean }) {
  const colors = useThemeColors();
  const reducedMotion = useReducedMotion();

  return (
    <View
      style={[
        styles.flameWell,
        {
          backgroundColor: withAlpha(colors.warning, lit ? 0.22 : 0.1),
          borderColor: lit ? colors.warning : withAlpha(colors.warning, 0.35),
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Image
        source={lit ? flameGif : flameZeroGif}
        style={styles.flame}
        contentFit="cover"
        autoplay={!reducedMotion}
      />
    </View>
  );
}
