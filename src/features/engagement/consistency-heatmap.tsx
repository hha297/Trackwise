import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  buildDayActivity,
  buildHeatmapWeeks,
  heatmapRangeKeys,
  type CategoryDayFlags,
  type DayActivity,
} from '@/features/engagement/activity-days';
import { radii, spacing } from '@/theme';
import { fonts } from '@/theme/fonts';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey } from '@/utils/date';

type ConsistencyHeatmapProps = {
  todayKey: string;
  flagsByDay: Map<string, CategoryDayFlags>;
  locale: string;
  weeks?: number;
};

const CELL_GAP = 3;
/** Fixed row height — cells widen to fill, never grow taller. */
const CELL_HEIGHT = 20;

function cellColor(
  day: DayActivity,
  colors: ReturnType<typeof useThemeColors>,
): string {
  if (day.isFuture) return 'transparent';
  if (day.intensity === 0) return colors.surfaceMuted;
  if (day.intensity === 1) return colors.primaryMuted;
  if (day.intensity === 2) return colors.primary;
  return colors.primaryPressed;
}

function shortWeekday(locale: string, date: Date): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' })
    .format(date)
    .replace(/\.$/, '');
}

/** GitHub-style contribution heatmap — fixed height, width fills the row. */
export function ConsistencyHeatmap({
  todayKey,
  flagsByDay,
  locale,
  weeks = 12,
}: ConsistencyHeatmapProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [selected, setSelected] = useState<DayActivity | null>(null);

  const columns = useMemo(() => {
    const keys = heatmapRangeKeys(todayKey, weeks);
    return buildHeatmapWeeks(keys, flagsByDay, todayKey);
  }, [todayKey, flagsByDay, weeks]);

  // Mon–Sun short labels (e.g. Tue, Thu); show Tue / Thu / Sat to match GitHub density.
  const weekdayLabels = useMemo(() => {
    const monday = parseDiaryDateKey('2026-11-09');
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return shortWeekday(locale, d);
    });
  }, [locale]);

  function selectDay(day: DayActivity) {
    if (day.isFuture) return;
    setSelected((prev) => (prev?.dayKey === day.dayKey ? null : day));
  }

  const detail =
    selected ??
    buildDayActivity({
      dayKey: todayKey,
      flags: flagsByDay.get(todayKey),
      todayKey,
    });

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    [locale],
  );

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="headingSmall">{t('engagement.consistency.heatmapTitle')}</Text>
          <Text variant="caption" tone="muted">
            {t('engagement.consistency.lastWeeks', { count: weeks })}
          </Text>
        </View>
      </View>

      <View style={styles.gridRow}>
        <View style={[styles.weekdayCol, { gap: CELL_GAP }]}>
          {weekdayLabels.map((label, index) => (
            <Text
              key={`${label}-${index}`}
              tone="muted"
              numberOfLines={1}
              style={styles.weekdayLabel}
            >
              {index % 2 === 1 ? label : ' '}
            </Text>
          ))}
        </View>
        <View style={[styles.weeksRow, { gap: CELL_GAP }]}>
          {columns.map((week, wi) => (
            <View key={`w-${wi}`} style={[styles.weekCol, { gap: CELL_GAP }]}>
              {week.map((day) => {
                const isSelected = detail.dayKey === day.dayKey && !day.isFuture;
                return (
                  <Pressable
                    key={day.dayKey}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    disabled={day.isFuture}
                    onPress={() => selectDay(day)}
                    hitSlop={2}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: cellColor(day, colors),
                        borderWidth: isSelected ? 2 : day.isToday ? 1 : 0,
                        borderColor: isSelected ? colors.textPrimary : colors.warning,
                        opacity: day.isFuture ? 0 : 1,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legendRow}>
        <Text variant="fine" tone="muted">
          {t('engagement.consistency.less')}
        </Text>
        {[0, 1, 2, 3].map((level) => (
          <View
            key={level}
            style={[
              styles.legendCell,
              {
                backgroundColor: cellColor(
                  {
                    dayKey: todayKey,
                    nutrition: level > 0,
                    hydration: level > 1,
                    workout: level > 2,
                    intensity: level as 0 | 1 | 2 | 3,
                    anyActive: level > 0,
                    isFuture: false,
                    isToday: false,
                  },
                  colors,
                ),
              },
            ]}
          />
        ))}
        <Text variant="fine" tone="muted">
          {t('engagement.consistency.more')}
        </Text>
      </View>

      <View
        style={[
          styles.detailPanel,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <Text variant="bodyStrong">
          {dateFmt.format(parseDiaryDateKey(detail.dayKey))}
          {detail.isToday ? ` · ${t('engagement.consistency.today')}` : ''}
        </Text>
        <Text variant="caption" tone="secondary">
          {detail.anyActive
            ? t('engagement.consistency.dayCounted')
            : t('engagement.consistency.dayEmpty')}
        </Text>
        <View style={styles.detailCats}>
          <Text variant="caption" tone={detail.nutrition ? 'brand' : 'muted'}>
            {t('engagement.streaks.nutrition')}:{' '}
            {detail.nutrition
              ? t('engagement.consistency.active')
              : t('engagement.consistency.inactive')}
          </Text>
          <Text variant="caption" tone={detail.hydration ? 'brand' : 'muted'}>
            {t('engagement.streaks.hydration')}:{' '}
            {detail.hydration
              ? t('engagement.consistency.active')
              : t('engagement.consistency.inactive')}
          </Text>
          <Text variant="caption" tone={detail.workout ? 'brand' : 'muted'}>
            {t('engagement.streaks.workout')}:{' '}
            {detail.workout
              ? t('engagement.consistency.active')
              : t('engagement.consistency.inactive')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  weekdayCol: {
    width: 36,
    justifyContent: 'flex-start',
  },
  weekdayLabel: {
    height: CELL_HEIGHT,
    lineHeight: CELL_HEIGHT,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    textAlign: 'left',
  },
  weeksRow: {
    flex: 1,
    flexDirection: 'row',
  },
  weekCol: {
    flex: 1,
    minWidth: 0,
  },
  cell: {
    width: '100%',
    height: CELL_HEIGHT,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  detailPanel: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[2],
  },
  detailCats: {
    gap: 4,
  },
});
