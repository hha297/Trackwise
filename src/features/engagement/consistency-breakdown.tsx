import { Image } from 'expo-image';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Droplets,
  Dumbbell,
  Flame,
  Utensils,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { countCategoryActiveDays } from '@/features/engagement/activity-days';
import { shiftDiaryDateKey } from '@/features/engagement/dates';
import {
  activityDaysForKind,
  summarizeDayActivity,
  type ActivityHistoryDay,
  type ActivityHistoryItem,
  type ActivityHistoryKind,
} from '@/features/progress/activity-history';
import { iconSizes, radii, spacing, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey } from '@/utils/date';

type ConsistencyBreakdownProps = {
  todayKey: string;
  nutritionKeys: string[];
  hydrationKeys: string[];
  workoutCompletedKeys: string[];
  /** Window in days ending today (default 84 = 12 weeks). */
  windowDays?: number;
  locale: string;
  /** Period activity records — shown when a category is expanded. */
  activityDays: ActivityHistoryDay[];
};

const THUMB = 44;

function formatMl(amountMl: number, locale: string): string {
  if (amountMl >= 1000) {
    const liters = amountMl / 1000;
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: liters >= 10 ? 0 : 1,
    }).format(liters)} L`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amountMl)} ml`;
}

function formatG(amountG: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: amountG >= 100 ? 0 : 1,
  }).format(amountG)} g`;
}

function formatDayChip(
  kind: ActivityHistoryKind,
  items: ActivityHistoryItem[],
  locale: string,
  labelKcal: (value: number) => string,
  labelMin: (value: number) => string,
  labelCount: (count: number) => string,
): string {
  const summary = summarizeDayActivity(kind, items).primary;
  if (!summary) return labelCount(items.length);
  if (summary.type === 'ml') return formatMl(summary.value, locale);
  if (summary.type === 'g') return formatG(summary.value, locale);
  if (summary.type === 'kcal') return labelKcal(summary.value);
  return labelMin(summary.value);
}

/** Category active-day counts + collapsible, visually rich activity details. */
export function ConsistencyBreakdown({
  todayKey,
  nutritionKeys,
  hydrationKeys,
  workoutCompletedKeys,
  windowDays = 84,
  locale,
  activityDays,
}: ConsistencyBreakdownProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const startKey = shiftDiaryDateKey(todayKey, -(windowDays - 1));
  const [openKind, setOpenKind] = useState<ActivityHistoryKind | null>(null);

  const nutritionDays = countCategoryActiveDays(nutritionKeys, startKey, todayKey);
  const hydrationDays = countCategoryActiveDays(hydrationKeys, startKey, todayKey);
  const workoutDays = countCategoryActiveDays(workoutCompletedKeys, startKey, todayKey);

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    [locale],
  );

  function toggle(kind: ActivityHistoryKind) {
    setOpenKind((prev) => (prev === kind ? null : kind));
  }

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ gap: 2 }}>
        <Text variant="headingSmall">{t('engagement.consistency.breakdownTitle')}</Text>
        <Text variant="caption" tone="muted">
          {t('engagement.consistency.breakdownExpandHint', { count: windowDays })}
        </Text>
      </View>
      <View style={{ gap: spacing[2] }}>
        <CategoryBlock
          kind="nutrition"
          icon={<Utensils size={18} color={withAlpha(colors.primary, 0.75)} />}
          label={t('engagement.streaks.nutrition')}
          value={t('engagement.consistency.activeDaysCount', { count: nutritionDays })}
          color={colors.primary}
          open={openKind === 'nutrition'}
          onToggle={() => toggle('nutrition')}
          days={activityDaysForKind(activityDays, 'nutrition')}
          dateFmt={dateFmt}
          locale={locale}
          progress={nutritionDays / Math.max(windowDays, 1)}
        />
        <CategoryBlock
          kind="hydration"
          icon={<Droplets size={18} color={withAlpha(colors.info, 0.75)} />}
          label={t('engagement.streaks.hydration')}
          value={t('engagement.consistency.activeDaysCount', { count: hydrationDays })}
          color={colors.info}
          open={openKind === 'hydration'}
          onToggle={() => toggle('hydration')}
          days={activityDaysForKind(activityDays, 'hydration')}
          dateFmt={dateFmt}
          locale={locale}
          progress={hydrationDays / Math.max(windowDays, 1)}
        />
        <CategoryBlock
          kind="workout"
          icon={<Dumbbell size={18} color={withAlpha(colors.warning, 0.75)} />}
          label={t('engagement.streaks.workout')}
          value={t('engagement.consistency.activeDaysCount', { count: workoutDays })}
          color={colors.warning}
          open={openKind === 'workout'}
          onToggle={() => toggle('workout')}
          days={activityDaysForKind(activityDays, 'workout')}
          dateFmt={dateFmt}
          locale={locale}
          progress={workoutDays / Math.max(windowDays, 1)}
        />
      </View>
    </View>
  );
}

function CategoryBlock({
  kind,
  icon,
  label,
  value,
  color,
  open,
  onToggle,
  days,
  dateFmt,
  locale,
  progress,
}: {
  kind: ActivityHistoryKind;
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
  open: boolean;
  onToggle: () => void;
  days: ActivityHistoryDay[];
  dateFmt: Intl.DateTimeFormat;
  locale: string;
  progress: number;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const fill = Math.max(0, Math.min(1, progress));

  return (
    <View
      style={[
        styles.block,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: open ? withAlpha(color, 0.22) : colors.border,
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: withAlpha(color, 0.55) }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        onPress={onToggle}
        style={styles.header}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.iconWrap, { backgroundColor: withAlpha(color, 0.1) }]}>
            {icon}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: spacing[1] }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {label}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {value}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: withAlpha(color, 0.08) }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(fill * 100)}%`,
                    backgroundColor: withAlpha(color, 0.45),
                  },
                ]}
              />
            </View>
          </View>
        </View>
        {open ? (
          <ChevronUp size={iconSizes.md} color={colors.textMuted} />
        ) : (
          <ChevronDown size={iconSizes.md} color={colors.textMuted} />
        )}
      </Pressable>

      {open ? (
        <View style={styles.detail}>
          {days.length === 0 ? (
            <Text variant="caption" tone="muted">
              {t('engagement.consistency.breakdownEmptyCategory')}
            </Text>
          ) : (
            days.map((day) => (
              <View key={`${kind}-${day.dayKey}`} style={styles.dayBlock}>
                <View style={styles.dayHeader}>
                  <View
                    style={[styles.dayIconWrap, { backgroundColor: withAlpha(color, 0.1) }]}
                  >
                    <CalendarDays size={14} color={withAlpha(color, 0.75)} />
                  </View>
                  <Text variant="label" tone="secondary" numberOfLines={1}>
                    {dateFmt.format(parseDiaryDateKey(day.dayKey))}
                  </Text>
                  <View
                    style={[
                      styles.dayCountChip,
                      { backgroundColor: withAlpha(color, 0.08) },
                    ]}
                  >
                    <Text variant="fine" tone="secondary" numberOfLines={1}>
                      {formatDayChip(
                        kind,
                        day.items,
                        locale,
                        (value) => t('progress.activityHistory.kcal', { value }),
                        (value) => t('diary.workout.minutes', { value }),
                        (count) =>
                          t('engagement.consistency.breakdownItemCount', { count }),
                      )}
                    </Text>
                  </View>
                </View>
                <View style={styles.items}>
                  {day.items.map((item) => (
                    <DetailCard
                      key={item.id}
                      item={item}
                      locale={locale}
                      accent={color}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

function DetailCard({
  item,
  locale,
  accent,
}: {
  item: ActivityHistoryItem;
  locale: string;
  accent: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(item.imageUrl) && !imageFailed;

  const title =
    item.kind === 'hydration' ? t('progress.activityHistory.hydrationTitle') : item.title;

  const chips: { key: string; label: string; tone: string; bg: string }[] = [];
  if (item.kind === 'nutrition' && item.mealType) {
    chips.push({
      key: 'meal',
      label: t(`meals.${item.mealType}`),
      tone: colors.textSecondary,
      bg: withAlpha(colors.primary, 0.08),
    });
  }
  if (item.amountG != null) {
    chips.push({
      key: 'g',
      label: formatG(item.amountG, locale),
      tone: colors.textSecondary,
      bg: withAlpha(colors.info, 0.08),
    });
  }
  if (item.amountMl != null) {
    chips.push({
      key: 'ml',
      label: formatMl(item.amountMl, locale),
      tone: colors.textSecondary,
      bg: withAlpha(colors.info, 0.08),
    });
  }
  if (item.detail && item.kind === 'nutrition' && item.amountG == null && item.amountMl == null) {
    chips.push({
      key: 'serving',
      label: item.detail,
      tone: colors.textMuted,
      bg: colors.surfaceMuted,
    });
  }
  if (item.calories != null) {
    chips.push({
      key: 'kcal',
      label: t('progress.activityHistory.kcal', { value: item.calories }),
      tone: colors.textSecondary,
      bg: withAlpha(colors.warning, 0.1),
    });
  }
  if (item.kind === 'workout' && item.durationSec != null && item.durationSec > 0) {
    chips.push({
      key: 'min',
      label: t('diary.workout.minutes', {
        value: Math.max(1, Math.round(item.durationSec / 60)),
      }),
      tone: colors.textSecondary,
      bg: withAlpha(colors.warning, 0.08),
    });
  }

  const FallbackIcon =
    item.kind === 'nutrition' ? Utensils : item.kind === 'hydration' ? Droplets : Dumbbell;
  const softAccent = withAlpha(accent, 0.7);

  return (
    <View
      style={[
        styles.itemCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: withAlpha(accent, 0.08) }]}>
        {showImage ? (
          <Image
            source={{ uri: item.imageUrl! }}
            style={styles.thumbImage}
            contentFit="cover"
            onError={() => setImageFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <FallbackIcon size={20} color={softAccent} />
        )}
      </View>

      <View style={styles.itemCopy}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {chips.length > 0 ? (
          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <View
                key={chip.key}
                style={[styles.chip, { backgroundColor: chip.bg }]}
              >
                {chip.key === 'kcal' ? (
                  <Flame size={10} color={withAlpha(colors.warning, 0.75)} />
                ) : null}
                <Text variant="fine" style={{ color: chip.tone }} numberOfLines={1}>
                  {chip.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {t(`progress.activityHistory.kind.${item.kind}`)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    paddingLeft: spacing[3] + 4,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  detail: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
    paddingLeft: spacing[3] + 4,
    gap: spacing[3],
  },
  dayBlock: {
    gap: spacing[2],
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dayIconWrap: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCountChip: {
    marginLeft: 'auto',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  items: {
    gap: spacing[2],
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[2],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
});
