import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { ExerciseArtwork } from '@/features/workout/components/exercise-artwork';
import { formatElapsed, useWorkouts } from '@/features/workout/hooks';
import { formatWorkoutDay, resolveWorkoutName } from '@/features/workout/session-display';
import { fonts } from '@/theme/fonts';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export default function WorkoutHistoryScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const workouts = useWorkouts();

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing[3],
          }}
        >
          <Text variant="headingLarge" style={{ flex: 1, minWidth: 0 }}>
            {t('workout.historyEntry')}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <Text variant="bodyStrong" tone="secondary">
              {t('workout.back')}
            </Text>
          </Pressable>
        </View>

        {workouts.isLoading ? <LoadingState /> : null}
        {workouts.error ? (
          <ErrorState
            title={t('workout.historyLoadError')}
            body={workouts.error instanceof Error ? workouts.error.message : t('workout.retry')}
            onRetry={() => void workouts.refetch()}
          />
        ) : null}
        {(workouts.data?.length ?? 0) === 0 && !workouts.isLoading && !workouts.error ? (
          <EmptyState title={t('workout.emptyHistory')} body={t('workout.emptyHistoryBody')} />
        ) : null}

        {(workouts.data ?? []).map((workout) => {
          const exercises = workout.previews ?? [];
          const thumbs = exercises.slice(0, 5);
          const hidden = Math.max(0, exercises.length - thumbs.length);
          const kcal = Math.round(Number(workout.estimated_calories ?? 0));
          return (
            <Pressable
              key={workout.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/workout/[id]', params: { id: workout.id } })
              }
            >
              <Card style={{ gap: spacing[3] }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing[3],
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: spacing[1] }}>
                    <Text variant="headingSmall" numberOfLines={2}>
                      {resolveWorkoutName(workout.name, t('workout.defaultName'))}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={2}>
                      {formatWorkoutDay(workout.started_at)}
                      {workout.active_duration_sec
                        ? ` · ${formatElapsed(workout.active_duration_sec)}`
                        : ''}
                      {(workout.set_count ?? 0) > 0
                        ? ` · ${t('diary.workout.sets', { count: workout.set_count })}`
                        : ''}
                    </Text>
                  </View>
                  {kcal > 0 ? (
                    <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                      <Text
                        tone="brand"
                        style={{
                          fontFamily: fonts.monoBold,
                          fontSize: 22,
                          lineHeight: 28,
                        }}
                      >
                        {kcal}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {t('diary.meals.kcalUnit')}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {thumbs.length ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      paddingTop: spacing[3],
                    }}
                  >
                    {thumbs.map((exercise, index) => (
                      <View
                        key={`${workout.id}-${exercise.slug ?? exercise.name}-${index}`}
                        style={{ marginLeft: index === 0 ? 0 : -6 }}
                      >
                        <ExerciseArtwork
                          imageUrl={exercise.image_url}
                          imageStoragePath={exercise.image_storage_path}
                          imageKey={exercise.image_key}
                          slug={exercise.slug}
                          name={exercise.name}
                          size={40}
                          recyclingKey={`${workout.id}-${exercise.slug ?? exercise.name}`}
                        />
                      </View>
                    ))}
                    <View style={{ flex: 1, minWidth: 0, marginLeft: 4 }}>
                      <Text variant="bodySmall" numberOfLines={2}>
                        {exercises
                          .slice(0, 3)
                          .map((item) => item.name)
                          .filter(Boolean)
                          .join(', ')}
                        {hidden > 0 ? ` ${t('diary.workout.more', { count: hidden })}` : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
