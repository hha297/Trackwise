import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Flame,
  History,
  LayoutTemplate,
  Play,
  Timer,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { weekDateKeys } from '@/features/diary/aggregations';
import { useWorkoutsInRange } from '@/features/diary/hooks';
import {
  WORKOUT_CATEGORY_IMAGES,
  WORKOUT_IMAGE_CATEGORIES,
  type ImageWorkoutCategory,
} from '@/features/workout/category-assets';
import { formatElapsed, useWorkouts } from '@/features/workout/hooks';
import { draftSetIsLogged } from '@/features/workout/logged-set';
import { formatWorkoutDay, resolveWorkoutName } from '@/features/workout/session-display';
import { useActiveWorkoutStore } from '@/stores/active-workout-store';
import { iconSizes, layout, radii, spacing, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { toDiaryDateKey } from '@/utils/date';

const CATEGORY_ASPECT = 1.15;
const CATEGORY_GAP = spacing[3];

function weeklyDurationSec(
  workouts: {
    active_duration_sec?: number | null;
    started_at: string;
    ended_at?: string | null;
  }[],
) {
  return workouts.reduce((sum, workout) => {
    if (workout.active_duration_sec != null && workout.active_duration_sec > 0) {
      return sum + workout.active_duration_sec;
    }
    if (workout.ended_at) {
      const ms =
        new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime();
      if (Number.isFinite(ms) && ms > 0) return sum + Math.round(ms / 1000);
    }
    return sum;
  }, 0);
}

function pairsOf<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

export function WorkoutDashboard() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const active = useActiveWorkoutStore();
  const history = useWorkouts();
  const todayKey = toDiaryDateKey();
  const weekKeys = useMemo(() => weekDateKeys(todayKey), [todayKey]);
  const weekWorkouts = useWorkoutsInRange(weekKeys[0]!, weekKeys[weekKeys.length - 1]!);

  const categoryTileSize = useMemo(() => {
    const contentWidth = Math.max(0, windowWidth - layout.screenPaddingX * 2);
    const width = Math.floor((contentWidth - CATEGORY_GAP) / 2);
    const height = Math.max(100, Math.round(width / CATEGORY_ASPECT));
    return { width, height };
  }, [windowWidth]);

  const hasActive = Boolean(active.startedAt);
  const totalExercises = active.exercises.length;
  const completedExercises = active.exercises.filter((exercise) =>
    exercise.sets.some((set) => draftSetIsLogged(set)),
  ).length;
  const totalSets = active.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSets = active.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => draftSetIsLogged(set)).length,
    0,
  );
  const progressPct = Math.round(
    Math.min(
      1,
      Math.max(
        0,
        totalSets > 0
          ? completedSets / totalSets
          : totalExercises > 0
            ? completedExercises / totalExercises
            : 0,
      ),
    ) * 100,
  );

  const weekStats = useMemo(() => {
    const list = weekWorkouts.data ?? [];
    return {
      sessions: list.length,
      durationSec: weeklyDurationSec(list),
      calories: Math.round(
        list.reduce((sum, row) => sum + Number(row.estimated_calories ?? 0), 0),
      ),
    };
  }, [weekWorkouts.data]);

  const recent = (history.data ?? []).slice(0, 3);
  const categoryRows = useMemo(() => pairsOf(WORKOUT_IMAGE_CATEGORIES), []);
  const weekReady = !weekWorkouts.isLoading && !weekWorkouts.error;
  const weekEmpty = weekReady && weekStats.sessions === 0;
  const [sessionName, setSessionName] = useState('');

  const startQuick = () => {
    active.start({
      name: resolveWorkoutName(sessionName, t('workout.defaultName')),
    });
    router.push('/workout/active');
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="headingLarge">{t('workout.dashboardTitle')}</Text>
        <Text variant="bodySmall" tone="secondary">
          {t('workout.dashboardSubtitle')}
        </Text>
      </View>

      {hasActive ? (
        <Card style={styles.resumeCard}>
          <View style={styles.resumeCopy}>
            <Text variant="label" tone="secondary">
              {t('workout.continueSection')}
            </Text>
            <Text variant="headingSmall" numberOfLines={1}>
              {active.name || t('workout.defaultName')}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {t('workout.continueProgress', {
                completed: completedExercises,
                total: Math.max(totalExercises, 1),
              })}
              {totalSets > 0
                ? ` · ${t('workout.continueSets', {
                    completed: completedSets,
                    total: totalSets,
                  })}`
                : ''}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
            <View
              style={[styles.fill, { width: `${progressPct}%`, backgroundColor: colors.primary }]}
            />
          </View>
          <Button
            label={t('workout.resume')}
            iconStart={(color) => <Play size={16} color={color} fill={color} />}
            onPress={() => router.push('/workout/active')}
          />
          <Button
            label={t('workout.templatesEntry')}
            variant="secondary"
            iconStart={(color) => <LayoutTemplate size={17} color={color} />}
            onPress={() => router.push('/workout/templates')}
          />
        </Card>
      ) : (
        <Card style={styles.startCard}>
          <Input
            label={t('workout.sessionName')}
            value={sessionName}
            onChangeText={setSessionName}
            placeholder={t('workout.sessionNamePlaceholder')}
            autoCapitalize="words"
          />
          <Button
            label={t('workout.quickWorkout')}
            iconStart={(color) => <Play size={17} color={color} fill={color} />}
            onPress={startQuick}
          />
          <Button
            label={t('workout.templatesEntry')}
            variant="secondary"
            iconStart={(color) => <LayoutTemplate size={17} color={color} />}
            onPress={() => router.push('/workout/templates')}
          />
        </Card>
      )}

      <Card style={styles.weekCard}>
        <Text variant="headingSmall">{t('workout.weeklyActivity')}</Text>
        {weekWorkouts.isLoading ? <LoadingState /> : null}
        {weekWorkouts.error ? (
          <ErrorState
            title={t('workout.weeklyLoadError')}
            body={
              weekWorkouts.error instanceof Error
                ? weekWorkouts.error.message
                : t('workout.retry')
            }
            onRetry={() => void weekWorkouts.refetch()}
          />
        ) : null}
        {weekReady ? (
          weekEmpty ? (
            <Text variant="bodySmall" tone="muted">
              {t('workout.weeklyEmpty')}
            </Text>
          ) : (
            <View style={styles.metricStrip}>
              <MetricCell
                icon={<Dumbbell size={15} color={colors.primary} strokeWidth={2.2} />}
                label={t('workout.weeklySessions')}
                value={String(weekStats.sessions)}
              />
              <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
              <MetricCell
                icon={<Timer size={15} color={colors.primary} strokeWidth={2.2} />}
                label={t('workout.weeklyDuration')}
                value={formatElapsed(weekStats.durationSec)}
              />
              <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
              <MetricCell
                icon={<Flame size={15} color={colors.primary} strokeWidth={2.2} />}
                label={t('workout.weeklyCalories')}
                value={`~${weekStats.calories}`}
              />
            </View>
          )
        ) : null}
      </Card>

      <View style={styles.section}>
        <Text variant="headingSmall">{t('workout.categories')}</Text>
        <View style={styles.categoryGrid}>
          {categoryRows.map((row) => (
            <View key={row.join('-')} style={styles.categoryRow}>
              {row.map((category) => (
                <CategoryTile
                  key={category}
                  category={category}
                  width={categoryTileSize.width}
                  height={categoryTileSize.height}
                />
              ))}
              {row.length === 1 ? (
                <View style={{ width: categoryTileSize.width, height: categoryTileSize.height }} />
              ) : null}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="headingSmall">{t('workout.explore')}</Text>
        <View style={styles.exploreStack}>
          <ExploreCard
            title={t('workout.exerciseLibrary')}
            body={t('workout.exerciseLibraryBody')}
            icon={<BookOpen size={20} color={colors.primary} strokeWidth={2.2} />}
            onPress={() =>
              router.push({ pathname: '/workout/exercises', params: { mode: 'browse' } })
            }
          />
          <ExploreCard
            title={t('workout.historyEntry')}
            body={t('workout.historyEntryBody')}
            icon={<History size={20} color={colors.primary} strokeWidth={2.2} />}
            onPress={() => router.push('/workout/history')}
          />
          <ExploreCard
            title={t('phase1.planTitle')}
            body={t('phase1.planHint')}
            icon={<CalendarDays size={20} color={colors.primary} strokeWidth={2.2} />}
            onPress={() => router.push('/workout/plan')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text variant="headingSmall" style={styles.flexShrink}>
            {t('workout.recent')}
          </Text>
          {recent.length > 0 ? (
            <Pressable onPress={() => router.push('/workout/history')} hitSlop={10}>
              <Text variant="caption" tone="secondary">
                {t('workout.historyEntry')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {recent.length === 0 ? (
          <Card style={styles.emptyRecent}>
            <Text variant="bodyStrong">{t('workout.emptyHistory')}</Text>
            <Text variant="bodySmall" tone="muted">
              {t('workout.emptyHistoryBody')}
            </Text>
          </Card>
        ) : (
          <View style={styles.recentStack}>
            {recent.map((workout) => (
              <Pressable
                key={workout.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/workout/[id]', params: { id: workout.id } })
                }
              >
                {({ pressed }) => (
                  <Card style={[styles.recentCard, { opacity: pressed ? 0.92 : 1 }]}>
                    <View style={styles.recentRow}>
                      <View style={styles.recentCopy}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {resolveWorkoutName(workout.name, t('workout.defaultName'))}
                        </Text>
                        <Text variant="caption" tone="secondary" numberOfLines={1}>
                          {formatWorkoutDay(workout.started_at)}
                          {workout.active_duration_sec
                            ? ` · ${formatElapsed(workout.active_duration_sec)}`
                            : ''}
                          {Number(workout.estimated_calories) > 0
                            ? ` · ~${Math.round(workout.estimated_calories)} ${t('diary.meals.kcalUnit')}`
                            : ''}
                        </Text>
                      </View>
                      <ChevronRight size={iconSizes.md} color={colors.textMuted} />
                    </View>
                  </Card>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function MetricCell({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCell}>
      <View style={styles.metricIconRow}>{icon}</View>
      <Text variant="metric" numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={2} style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

function ExploreCard({
  title,
  body,
  icon,
  onPress,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      {({ pressed }) => (
        <Card style={[styles.exploreCard, { opacity: pressed ? 0.92 : 1 }]}>
          <View style={styles.exploreRow}>
            <View
              style={[styles.exploreIcon, { backgroundColor: withAlpha(colors.primary, 0.14) }]}
            >
              {icon}
            </View>
            <View style={styles.exploreCopy}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {title}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {body}
              </Text>
            </View>
            <ChevronRight size={iconSizes.md} color={colors.textMuted} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function CategoryTile({
  category,
  width,
  height,
}: {
  category: ImageWorkoutCategory;
  width: number;
  height: number;
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`workout.category.${category}`)}
      onPress={() =>
        router.push({
          pathname: '/workout/library',
          params: { top: category },
        })
      }
      style={({ pressed }) => [
        styles.categoryTile,
        { width, height, opacity: pressed ? 0.94 : 1 },
      ]}
    >
      <Image
        source={WORKOUT_CATEGORY_IMAGES[category]}
        style={{ width, height }}
        contentFit="cover"
        transition={120}
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', withAlpha('#000000', 0.55)]}
        locations={[0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.categoryFooter}>
        <Text variant="bodyStrong" numberOfLines={1} style={styles.onImageTitle}>
          {t(`workout.category.${category}`)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[5],
  },
  header: {
    gap: spacing[1],
  },
  resumeCard: {
    gap: spacing[3],
  },
  startCard: {
    gap: spacing[3],
  },
  resumeCopy: {
    gap: spacing[1],
    minWidth: 0,
  },
  track: {
    height: 6,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  weekCard: {
    gap: spacing[3],
  },
  metricStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metricCell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[1],
  },
  metricIconRow: {
    height: 18,
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
  },
  metricLabel: {
    textAlign: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing[1],
  },
  section: {
    gap: spacing[3],
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  flexShrink: {
    flexShrink: 1,
    minWidth: 0,
  },
  categoryGrid: {
    gap: CATEGORY_GAP,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: CATEGORY_GAP,
  },
  categoryTile: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#202020',
    position: 'relative',
  },
  categoryFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
    paddingTop: spacing[5],
  },
  onImageTitle: {
    color: '#FFFFFF',
  },
  exploreStack: {
    gap: spacing[2],
  },
  exploreCard: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  exploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  exploreIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  exploreCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 2,
  },
  emptyRecent: {
    gap: spacing[1],
  },
  recentStack: {
    gap: spacing[2],
  },
  recentCard: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  recentCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 2,
  },
});
