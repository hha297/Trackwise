import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Star, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useLatestWeight } from '@/features/measurements/hooks';
import {
  EXERCISE_IMAGE_PLACEHOLDER,
  fallbackExerciseImage,
  resolveExerciseImage,
} from '@/features/workout/catalog/exercise-images';
import {
  EXERCISE_PREVIEW_DURATION_MIN,
  estimateExercisePreviewCalories,
} from '@/features/workout/calculations';
import { CoachingBody } from '@/features/workout/components/coaching-body';
import { ExerciseListCard } from '@/features/workout/components/exercise-list-card';
import {
  formatEquipmentLabel,
  formatMovementPattern,
  formatMuscleList,
} from '@/features/workout/exercise-display';
import {
  useExerciseDetail,
  useExerciseFavorites,
  useExercises,
  useToggleExerciseFavorite,
} from '@/features/workout/hooks';
import { useActiveWorkoutStore } from '@/stores/active-workout-store';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export default function ExerciseDetailScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useExerciseDetail(id ?? null);
  const favorites = useExerciseFavorites();
  const toggleFavorite = useToggleExerciseFavorite();
  const weight = useLatestWeight();
  const startedAt = useActiveWorkoutStore((state) => state.startedAt);
  const addExercise = useActiveWorkoutStore((state) => state.addExercise);
  const start = useActiveWorkoutStore((state) => state.start);
  const [imageStage, setImageStage] = useState<{
    key: string;
    stage: 'primary' | 'fallback' | 'placeholder';
  }>({ key: '', stage: 'primary' });

  const exercise = detail.data;
  const favoriteIds = new Set(favorites.data ?? []);
  const isFavorite = exercise ? favoriteIds.has(exercise.id) : false;
  const caloriePreview =
    exercise && weight.weightKg && weight.weightKg > 0
      ? estimateExercisePreviewCalories({
          exerciseType: exercise.exercise_type,
          metValue: exercise.met_value,
          name: exercise.name,
          bodyWeightKg: weight.weightKg,
        })
      : null;

  const relatedPath = exercise?.library_paths?.[0] ?? null;
  const related = useExercises({
    libraryPath: relatedPath,
    enabled: Boolean(relatedPath),
  });

  if (detail.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (detail.error || !exercise) {
    return (
      <Screen>
        <ErrorState
          title={t('workout.detailError')}
          body={detail.error instanceof Error ? detail.error.message : t('workout.retry')}
          onRetry={() => void detail.refetch()}
        />
      </Screen>
    );
  }

  const resolved = resolveExerciseImage({
    imageUrl: exercise.image_url,
    imageStoragePath: exercise.image_storage_path,
    imageKey: exercise.image_key,
    slug: exercise.slug,
    name: exercise.name,
  });
  const bundled = fallbackExerciseImage({
    imageKey: exercise.image_key,
    slug: exercise.slug,
    name: exercise.name,
  });
  const imageKey = `${exercise.id}:${exercise.image_url ?? ''}`;
  const stage = imageStage.key === imageKey ? imageStage.stage : 'primary';
  const image =
    stage === 'placeholder'
      ? EXERCISE_IMAGE_PLACEHOLDER
      : stage === 'fallback'
        ? bundled
        : resolved;

  const relatedList = (related.data ?? [])
    .filter((item) => item.id !== exercise.id)
    .slice(0, 6);

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-4">
        <View className="flex-row items-start gap-2">
          <ChromeIconButton
            header
            label={t('workout.close')}
            onPress={() => router.back()}
            icon={(color) => <X size={22} color={color} />}
          />
          <Text variant="headingLarge" className="min-w-0 flex-1" numberOfLines={3}>
            {exercise.name}
          </Text>
        </View>

        <View
          style={{
            width: '100%',
            aspectRatio: 4 / 3,
            borderRadius: radii.lg,
            overflow: 'hidden',
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Image
            source={image}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            priority="high"
            recyclingKey={`${exercise.id}:${exercise.image_url ?? ''}`}
            onError={() =>
              setImageStage((current) => {
                const currentStage = current.key === imageKey ? current.stage : 'primary';
                if (currentStage === 'primary' && bundled !== resolved) {
                  return { key: imageKey, stage: 'fallback' };
                }
                return { key: imageKey, stage: 'placeholder' };
              })
            }
          />
        </View>

        <Card className="gap-2">
          <MetaRow
            label={t('workout.primaryMuscles')}
            value={formatMuscleList(exercise.primary_muscles, t) || '—'}
          />
          <MetaRow
            label={t('workout.secondaryMuscles')}
            value={formatMuscleList(exercise.secondary_muscles, t) || '—'}
          />
          <MetaRow
            label={t('workout.equipmentLabel')}
            value={formatEquipmentLabel(exercise.equipment, t)}
          />
          <MetaRow
            label={t('workout.trackingType')}
            value={t(`workout.type.${exercise.exercise_type}`)}
          />
          {exercise.difficulty ? (
            <MetaRow
              label={t('workout.difficultyLabel')}
              value={t(`workout.difficulty.${exercise.difficulty}`)}
            />
          ) : null}
          {formatMovementPattern(exercise.movement_pattern, t) ? (
            <MetaRow
              label={t('workout.movementPattern')}
              value={formatMovementPattern(exercise.movement_pattern, t)!}
            />
          ) : null}
        </Card>

        {caloriePreview ? (
          <Text variant="caption" tone="secondary">
            {t('workout.summaryCalories', {
              value: Math.round(caloriePreview.estimatedCalories),
            })}
            {' · '}
            {t('workout.caloriesEstimateMetaIntensity', {
              minutes: caloriePreview.durationMin,
              intensity: t(`workout.intensity.${caloriePreview.intensity}`),
            })}
          </Text>
        ) : null}

        <Button
          label={t('workout.addToWorkout')}
          onPress={() => {
            if (!startedAt) {
              start({ name: t('workout.defaultName') });
            }
            addExercise({
              exerciseId: exercise.id,
              name: exercise.name,
              exerciseType: exercise.exercise_type,
              metValue: exercise.met_value,
              primaryMuscles: exercise.primary_muscles,
              imageUrl: exercise.image_url,
              imageStoragePath: exercise.image_storage_path,
              imageKey: exercise.image_key,
              slug: exercise.slug,
            });
            router.push('/workout/active');
          }}
        />

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              label={t('phase1.openProgress')}
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/workout/exercise-progress',
                  params: { id: exercise.id, name: exercise.name },
                })
              }
            />
          </View>
          <View className="flex-1">
            <Button
              label={isFavorite ? t('workout.favorited') : t('workout.favorite')}
              variant="secondary"
              iconStart={() => (
                <Star
                  size={16}
                  color={isFavorite ? colors.warning : colors.textMuted}
                  fill={isFavorite ? colors.warning : 'transparent'}
                  strokeWidth={1.75}
                />
              )}
              onPress={() => {
                void toggleFavorite.mutateAsync({
                  exerciseId: exercise.id,
                  favorite: !isFavorite,
                });
              }}
            />
          </View>
        </View>

        {exercise.description ? (
          <Card className="gap-2">
            <Text variant="label" tone="secondary">
              {t('workout.overview')}
            </Text>
            <CoachingBody text={exercise.description} />
          </Card>
        ) : null}

        {exercise.instructions ? (
          <Card className="gap-2">
            <Text variant="label" tone="secondary">
              {t('workout.instructions')}
            </Text>
            <CoachingBody text={exercise.instructions} />
          </Card>
        ) : null}

        {exercise.tips ? (
          <Card className="gap-2">
            <Text variant="label" tone="secondary">
              {t('workout.tips')}
            </Text>
            <CoachingBody text={exercise.tips} />
          </Card>
        ) : null}

        {exercise.common_mistakes ? (
          <Card className="gap-2">
            <Text variant="label" tone="secondary">
              {t('workout.commonMistakes')}
            </Text>
            <CoachingBody text={exercise.common_mistakes} />
          </Card>
        ) : null}

        {exercise.safety_notes ? (
          <Card className="gap-2">
            <Text variant="label" tone="secondary">
              {t('workout.safetyInfo')}
            </Text>
            <CoachingBody text={exercise.safety_notes} />
          </Card>
        ) : null}

        {relatedList.length ? (
          <View className="gap-2">
            <Text variant="label" tone="secondary">
              {t('workout.relatedExercises')}
            </Text>
            {relatedList.map((item) => {
              const fav = favoriteIds.has(item.id);
              return (
                <ExerciseListCard
                  key={item.id}
                  exercise={item}
                  favorite={fav}
                  estimatedKcal={
                    weight.weightKg && weight.weightKg > 0
                      ? estimateExercisePreviewCalories({
                          exerciseType: item.exercise_type,
                          metValue: item.met_value,
                          name: item.name,
                          bodyWeightKg: weight.weightKg,
                        })?.estimatedCalories ?? null
                      : null
                  }
                  estimateMinutes={EXERCISE_PREVIEW_DURATION_MIN}
                  estimateActivityLabel={(() => {
                    if (!(weight.weightKg && weight.weightKg > 0)) return null;
                    const preview = estimateExercisePreviewCalories({
                      exerciseType: item.exercise_type,
                      metValue: item.met_value,
                      name: item.name,
                      bodyWeightKg: weight.weightKg,
                    });
                    if (!preview || preview.evidence === 'compendium_activity') return null;
                    return t(`workout.activityClass.${preview.activityLabelKey}`);
                  })()}
                  onToggleFavorite={() => {
                    void toggleFavorite.mutateAsync({
                      exerciseId: item.id,
                      favorite: !fav,
                    });
                  }}
                  onPress={() =>
                    router.push({ pathname: '/workout/exercise/[id]', params: { id: item.id } })
                  }
                />
              );
            })}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text variant="caption" tone="secondary" className="shrink-0">
        {label}
      </Text>
      <Text variant="caption" className="min-w-0 flex-1 text-right" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
