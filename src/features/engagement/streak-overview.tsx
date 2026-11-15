import type { ReactNode } from 'react';
import { Droplets, Dumbbell, Utensils } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useEngagementStreaks } from '@/features/engagement/hooks';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { toDiaryDateKey } from '@/utils/date';

type StreakOverviewProps = {
  todayKey?: string;
};

function StreakRow({
  icon,
  label,
  current,
  longest,
  alive,
  accessibilityLabel,
}: {
  icon: ReactNode;
  label: string;
  current: number;
  longest: number;
  alive: boolean;
  accessibilityLabel: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View
      style={[styles.row, { backgroundColor: colors.surfaceMuted }]}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>{icon}</View>
        <View style={styles.labels}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {label}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {t('engagement.streaks.longest', { count: longest })}
          </Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text variant="metric" style={styles.currentValue} numberOfLines={1}>
          {current}
        </Text>
        <Text variant="caption" tone={alive ? 'secondary' : 'muted'} numberOfLines={1}>
          {alive ? t('engagement.streaks.daysAlive') : t('engagement.streaks.daysIdle')}
        </Text>
      </View>
    </View>
  );
}

/** Compact current-streak card for Diary — not a full analytics panel. */
export function StreakOverview({ todayKey = toDiaryDateKey() }: StreakOverviewProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data, isLoading, isError, refetch } = useEngagementStreaks(todayKey);

  if (isLoading && !data) {
    return (
      <Card>
        <Text variant="headingSmall">{t('engagement.streaks.title')}</Text>
        <Text variant="bodySmall" tone="secondary" style={styles.subtitle}>
          {t('engagement.streaks.loading')}
        </Text>
      </Card>
    );
  }

  if (isError && !data) {
    return (
      <Card>
        <Text variant="headingSmall">{t('engagement.streaks.title')}</Text>
        <Text variant="bodySmall" tone="secondary" style={styles.subtitle}>
          {t('engagement.streaks.loadError')}
        </Text>
        <Text
          variant="bodyStrong"
          tone="brand"
          onPress={() => {
            void refetch();
          }}
          accessibilityRole="button"
          style={styles.retry}
        >
          {t('engagement.streaks.retry')}
        </Text>
      </Card>
    );
  }

  if (!data) return null;

  const empty =
    data.nutrition.longest === 0 &&
    data.hydration.longest === 0 &&
    data.workout.longestCompletedDays === 0;

  return (
    <Card>
      <Text variant="headingSmall">{t('engagement.streaks.title')}</Text>
      <Text variant="bodySmall" tone="secondary" style={styles.subtitle}>
        {empty ? t('engagement.streaks.empty') : t('engagement.streaks.subtitle')}
      </Text>

      <View style={styles.list}>
        <StreakRow
          icon={<Utensils size={16} color={colors.primary} />}
          label={t('engagement.streaks.nutrition')}
          current={data.nutrition.current}
          longest={data.nutrition.longest}
          alive={data.nutrition.alive}
          accessibilityLabel={t('engagement.streaks.a11yNutrition', {
            current: data.nutrition.current,
            longest: data.nutrition.longest,
          })}
        />
        <StreakRow
          icon={<Droplets size={16} color={colors.primary} />}
          label={t('engagement.streaks.hydration')}
          current={data.hydration.current}
          longest={data.hydration.longest}
          alive={data.hydration.alive}
          accessibilityLabel={t('engagement.streaks.a11yHydration', {
            current: data.hydration.current,
            longest: data.hydration.longest,
          })}
        />
        <StreakRow
          icon={<Dumbbell size={16} color={colors.primary} />}
          label={t('engagement.streaks.workout')}
          current={data.workout.currentCompletedDays}
          longest={data.workout.longestCompletedDays}
          alive={data.workout.alive}
          accessibilityLabel={t('engagement.streaks.a11yWorkout', {
            current: data.workout.currentCompletedDays,
            longest: data.workout.longestCompletedDays,
          })}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: spacing[1],
    marginBottom: spacing[3],
  },
  list: {
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  currentValue: {
    fontSize: 20,
    lineHeight: 24,
  },
  retry: {
    marginTop: spacing[2],
  },
});
