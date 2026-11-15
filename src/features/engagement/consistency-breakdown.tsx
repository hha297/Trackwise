import { Image } from 'expo-image';
import { ChevronDown, ChevronUp, Droplets, Dumbbell, Utensils } from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { iconSizes, radii, spacing } from '@/theme';
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
const DETAIL_PAGE_SIZE = 5;

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
          icon={<Utensils size={18} color={colors.textSecondary} />}
          label={t('engagement.streaks.nutrition')}
          value={t('engagement.consistency.activeDaysCount', { count: nutritionDays })}
          open={openKind === 'nutrition'}
          onToggle={() => toggle('nutrition')}
          days={activityDaysForKind(activityDays, 'nutrition')}
          dateFmt={dateFmt}
          locale={locale}
        />
        <CategoryBlock
          kind="hydration"
          icon={<Droplets size={18} color={colors.textSecondary} />}
          label={t('engagement.streaks.hydration')}
          value={t('engagement.consistency.activeDaysCount', { count: hydrationDays })}
          open={openKind === 'hydration'}
          onToggle={() => toggle('hydration')}
          days={activityDaysForKind(activityDays, 'hydration')}
          dateFmt={dateFmt}
          locale={locale}
        />
        <CategoryBlock
          kind="workout"
          icon={<Dumbbell size={18} color={colors.textSecondary} />}
          label={t('engagement.streaks.workout')}
          value={t('engagement.consistency.activeDaysCount', { count: workoutDays })}
          open={openKind === 'workout'}
          onToggle={() => toggle('workout')}
          days={activityDaysForKind(activityDays, 'workout')}
          dateFmt={dateFmt}
          locale={locale}
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
  open,
  onToggle,
  days,
  dateFmt,
  locale,
}: {
  kind: ActivityHistoryKind;
  icon: ReactNode;
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  days: ActivityHistoryDay[];
  dateFmt: Intl.DateTimeFormat;
  locale: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [visibleCount, setVisibleCount] = useState(DETAIL_PAGE_SIZE);
  const totalItems = days.reduce((count, day) => count + day.items.length, 0);

  useEffect(() => {
    if (!open) setVisibleCount(DETAIL_PAGE_SIZE);
  }, [open]);

  const visibleDays = useMemo(() => {
    let remaining = visibleCount;
    const next: ActivityHistoryDay[] = [];
    for (const day of days) {
      if (remaining <= 0) break;
      const items = day.items.slice(0, remaining);
      remaining -= items.length;
      if (items.length > 0) next.push({ ...day, items });
    }
    return next;
  }, [days, visibleCount]);

  return (
    <View style={[styles.block, { borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        onPress={onToggle}
        style={styles.header}
      >
        <View style={styles.rowLeft}>
          {icon}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {label}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {value}
            </Text>
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
            visibleDays.map((day) => (
              <View key={`${kind}-${day.dayKey}`} style={styles.dayBlock}>
                <View style={styles.dayHeader}>
                  <Text variant="label" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                    {dateFmt.format(parseDiaryDateKey(day.dayKey))}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {formatDayChip(
                      kind,
                      day.items,
                      locale,
                      (chipValue) => t('progress.activityHistory.kcal', { value: chipValue }),
                      (chipValue) => t('diary.workout.minutes', { value: chipValue }),
                      (count) => t('engagement.consistency.breakdownItemCount', { count }),
                    )}
                  </Text>
                </View>
                <View style={styles.items}>
                  {day.items.map((item) => (
                    <DetailCard key={item.id} item={item} locale={locale} />
                  ))}
                </View>
              </View>
            ))
          )}
          {totalItems > DETAIL_PAGE_SIZE ? (
            <View style={styles.pager}>
              {visibleCount < totalItems ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setVisibleCount((count) => Math.min(totalItems, count + DETAIL_PAGE_SIZE))
                  }
                  hitSlop={8}
                >
                  <Text variant="caption" tone="brand">
                    {t('engagement.consistency.breakdownShowMore')}
                  </Text>
                </Pressable>
              ) : null}
              {visibleCount > DETAIL_PAGE_SIZE ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setVisibleCount(DETAIL_PAGE_SIZE)}
                  hitSlop={8}
                >
                  <Text variant="caption" tone="brand">
                    {t('engagement.consistency.breakdownShowLess')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DetailCard({ item, locale }: { item: ActivityHistoryItem; locale: string }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(item.imageUrl) && !imageFailed;

  const title =
    item.kind === 'hydration' ? t('progress.activityHistory.hydrationTitle') : item.title;

  const facts: string[] = [];
  if (item.kind === 'nutrition' && item.mealType) facts.push(t(`meals.${item.mealType}`));
  if (item.amountG != null) facts.push(formatG(item.amountG, locale));
  if (item.amountMl != null) facts.push(formatMl(item.amountMl, locale));
  if (item.detail && item.kind === 'nutrition' && item.amountG == null && item.amountMl == null) {
    facts.push(item.detail);
  }
  if (item.calories != null) {
    facts.push(t('progress.activityHistory.kcal', { value: item.calories }));
  }
  if (item.kind === 'workout' && item.durationSec != null && item.durationSec > 0) {
    facts.push(
      t('diary.workout.minutes', { value: Math.max(1, Math.round(item.durationSec / 60)) }),
    );
  }

  const FallbackIcon =
    item.kind === 'nutrition' ? Utensils : item.kind === 'hydration' ? Droplets : Dumbbell;

  return (
    <View style={[styles.itemCard, { borderColor: colors.border }]}>
      <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
        {showImage ? (
          <Image
            source={{ uri: item.imageUrl! }}
            style={styles.thumbImage}
            contentFit="cover"
            onError={() => setImageFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <FallbackIcon size={18} color={colors.textMuted} />
        )}
      </View>
      <View style={styles.itemCopy}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {facts.length > 0 ? facts.join(' · ') : t(`progress.activityHistory.kind.${item.kind}`)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
    minWidth: 0,
  },
  detail: {
    gap: spacing[3],
    paddingTop: spacing[3],
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  dayBlock: {
    gap: spacing[2],
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
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
});
