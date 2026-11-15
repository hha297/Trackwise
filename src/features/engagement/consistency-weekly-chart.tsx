import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import {
  buildWeeklyActiveBars,
  type CategoryDayFlags,
} from '@/features/engagement/activity-days';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey } from '@/utils/date';

type ConsistencyWeeklyChartProps = {
  todayKey: string;
  flagsByDay: Map<string, CategoryDayFlags>;
  locale: string;
};

const SEGMENT = 22;

/** Last 7 days — stacked bars by Nutrition / Hydration / Workout (not entry counts). */
export function ConsistencyWeeklyChart({
  todayKey,
  flagsByDay,
  locale,
}: ConsistencyWeeklyChartProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const bars = useMemo(
    () => buildWeeklyActiveBars(flagsByDay, todayKey),
    [flagsByDay, todayKey],
  );
  const activeCount = bars.filter((day) => day.anyActive).length;
  const weekday = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }),
    [locale],
  );

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ gap: 2 }}>
        <Text variant="headingSmall">{t('engagement.consistency.weeklyActivity')}</Text>
        <Text variant="caption" tone="muted">
          {t('engagement.consistency.weeklyHint')}
        </Text>
        <Text variant="caption" tone="secondary">
          {t('engagement.consistency.weeklyActiveDays', { count: activeCount })}
        </Text>
      </View>

      <View style={styles.chart}>
        {bars.map((day) => {
          const segments = [
            day.nutrition ? { key: 'n', color: colors.primary } : null,
            day.hydration ? { key: 'h', color: colors.info } : null,
            day.workout ? { key: 'w', color: colors.warning } : null,
          ].filter(Boolean) as { key: string; color: string }[];

          return (
            <View key={day.dayKey} style={styles.barCol}>
              <View style={styles.barTrack}>
                {segments.length === 0 ? (
                  <View
                    style={[
                      styles.emptyBar,
                      { backgroundColor: colors.surfaceMuted },
                    ]}
                  />
                ) : (
                  <View style={styles.stack}>
                    {segments.map((segment) => (
                      <View
                        key={segment.key}
                        style={[
                          styles.segment,
                          { backgroundColor: segment.color, height: SEGMENT },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
              <Text variant="fine" tone={day.isToday ? 'primary' : 'muted'}>
                {weekday.format(parseDiaryDateKey(day.dayKey)).replace(/\.$/, '')}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendDot color={colors.primary} label={t('engagement.streaks.nutrition')} />
        <LegendDot color={colors.info} label={t('engagement.streaks.hydration')} />
        <LegendDot color={colors.warning} label={t('engagement.streaks.workout')} />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text variant="fine" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[2],
    height: 96,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
    height: '100%',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  stack: {
    width: '100%',
    gap: 2,
    justifyContent: 'flex-end',
  },
  segment: {
    width: '100%',
    borderRadius: radii.sm,
  },
  emptyBar: {
    width: '100%',
    height: 8,
    borderRadius: radii.sm,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
});
