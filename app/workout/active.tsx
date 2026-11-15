import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  Dumbbell,
  Pause,
  Play,
  Plus,
  TimerReset,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useLatestWeight } from '@/features/measurements/hooks';
import { totalVolumeKg } from '@/features/workout/calculations';
import {
  EXERCISE_IMAGE_PLACEHOLDER,
  resolveExerciseImage,
} from '@/features/workout/catalog/exercise-images';
import { SetMetricField } from '@/features/workout/components/set-metric-field';
import { WorkoutIconButton } from '@/features/workout/components/workout-icon-button';
import { formatElapsed, useFinishWorkout } from '@/features/workout/hooks';
import { draftSetIsLogged } from '@/features/workout/logged-set';
import { resolveWorkoutName } from '@/features/workout/session-display';
import { useActiveWorkoutStore, type DraftExercise } from '@/stores/active-workout-store';
import { iconSizes, radii, spacing } from '@/theme';
import { fonts } from '@/theme/fonts';
import { useTheme, useThemeColors } from '@/theme/theme-provider';

export default function ActiveWorkoutScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { scheme } = useTheme();
  const store = useActiveWorkoutStore();
  const finish = useFinishWorkout();
  const weight = useLatestWeight();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);

  if (!store.startedAt) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing[8],
            gap: spacing[4],
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Dumbbell size={36} color={colors.primary} />
          </View>
          <Text variant="headingMedium" style={{ textAlign: 'center' }}>
            {t('workout.noActive')}
          </Text>
          <Text variant="bodySmall" tone="secondary" style={{ textAlign: 'center' }}>
            {t('workout.noActiveBody')}
          </Text>
          <View style={{ alignSelf: 'stretch', marginTop: spacing[2] }}>
            <Button label={t('workout.back')} onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  const volume = totalVolumeKg(
    store.exercises.flatMap((exercise) =>
      exercise.sets
        .filter((set) => draftSetIsLogged(set) && set.weightKg && set.reps)
        .map((set) => ({ weightKg: Number(set.weightKg), reps: Number(set.reps) })),
    ),
  );

  async function onFinish() {
    if (!(weight.weightKg && weight.weightKg > 0)) {
      Alert.alert(t('workout.weightRequiredTitle'), t('workout.weightRequiredBody'));
      return;
    }
    try {
      const result = await finish.mutateAsync({
        name: resolveWorkoutName(store.name, t('workout.defaultName')),
        startedAt: store.startedAt!,
        activeDurationSec: store.getActiveDurationSec(),
        notes: store.notes,
        sourceTemplateId: store.sourceTemplateId,
        exercises: store.exercises,
        bodyWeightKg: weight.weightKg,
      });
      store.reset();
      router.replace({
        pathname: '/workout/summary',
        params: {
          id: result.workoutId,
          estimated: String(result.estimated),
          volume: String(result.volume),
          durationMin: String(result.durationMin),
          intensity: result.intensity,
          prs: JSON.stringify(result.personalRecords),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'BODY_WEIGHT_REQUIRED'
          ? t('workout.weightRequiredBody')
          : error instanceof Error
            ? error.message
            : t('workout.retry');
      Alert.alert(t('workout.saveFailed'), message);
    }
  }

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Pressable onPress={() => setNameOpen((open) => !open)} hitSlop={8}>
              <Text variant="headingSmall" numberOfLines={1}>
                {resolveWorkoutName(store.name, t('workout.defaultName'))}
              </Text>
            </Pressable>
            <ActiveElapsedLabel paused={store.paused} />
            {volume > 0 ? (
              <Text variant="caption" tone="secondary">
                {t('workout.volumeSoFar', { value: volume })}
              </Text>
            ) : null}
          </View>
          <WorkoutIconButton
            accessibilityLabel={store.paused ? t('workout.resume') : t('workout.paused')}
            onPress={() => (store.paused ? store.resume() : store.pause())}
          >
            {store.paused ? (
              <Play size={18} color={scheme === 'dark' ? colors.primary : colors.textPrimary} />
            ) : (
              <Pause size={18} color={colors.textPrimary} />
            )}
          </WorkoutIconButton>
          <WorkoutIconButton
            accessibilityLabel={t('workout.discard')}
            tone="danger"
            onPress={() => setDiscardOpen(true)}
          >
            <X size={18} color={colors.error} />
          </WorkoutIconButton>
        </View>

        {nameOpen ? (
          <Input
            label={t('workout.sessionName')}
            value={store.name}
            onChangeText={store.setName}
            placeholder={t('workout.sessionNamePlaceholder')}
            autoCapitalize="words"
            autoFocus
          />
        ) : null}

        <DeleteConfirmDialog
          visible={discardOpen}
          title={t('workout.discardTitle')}
          body={t('workout.discardBody')}
          cancelLabel={t('workout.keep')}
          confirmLabel={t('workout.discard')}
          onCancel={() => setDiscardOpen(false)}
          onConfirm={() => {
            setDiscardOpen(false);
            store.reset();
            router.back();
          }}
        />

        <ActiveRestBanner />

        <Button
          label={t('workout.addExercise')}
          variant="secondary"
          iconStart={(color) => <Plus size={18} color={color} />}
          onPress={() =>
            router.push({ pathname: '/workout/exercises', params: { mode: 'pick' } })
          }
        />

        {store.exercises.length === 0 ? (
          <Text variant="bodySmall" tone="muted">
            {t('workout.addExerciseHint')}
          </Text>
        ) : null}

        {store.exercises.map((exercise, index) => (
          <Card key={exercise.localId} style={{ gap: spacing[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <ActiveExerciseThumb exercise={exercise} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text variant="headingSmall" numberOfLines={1}>
                  {exercise.name}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {t(`workout.type.${exercise.exerciseType}`)}
                  {exercise.plannedReps
                    ? ` · ${t('workout.plannedReps', { value: exercise.plannedReps })}`
                    : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[1] }}>
                <WorkoutIconButton
                  size={36}
                  accessibilityLabel={t('workout.moveUp')}
                  onPress={() => store.reorderExercise(exercise.localId, 'up')}
                >
                  <ArrowUp size={16} color={colors.textSecondary} />
                </WorkoutIconButton>
                <WorkoutIconButton
                  size={36}
                  accessibilityLabel={t('workout.moveDown')}
                  onPress={() => store.reorderExercise(exercise.localId, 'down')}
                >
                  <ArrowDown size={16} color={colors.textSecondary} />
                </WorkoutIconButton>
                <WorkoutIconButton
                  size={36}
                  tone="danger"
                  accessibilityLabel={t('workout.remove')}
                  onPress={() => store.removeExercise(exercise.localId)}
                >
                  <Trash2 size={16} color={colors.error} />
                </WorkoutIconButton>
              </View>
            </View>

            <View style={{ gap: spacing[2] }}>
              {exercise.sets.map((set) => (
                <View
                  key={set.localId}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 56,
                      borderRadius: radii.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: draftSetIsLogged(set)
                        ? colors.primaryMuted
                        : colors.surfaceMuted,
                    }}
                  >
                    <Text variant="metric">{set.setNumber}</Text>
                  </View>
                  {exercise.exerciseType === 'strength' ? (
                    <SetMetricField
                      unit={t('workout.kg')}
                      value={set.weightKg}
                      keyboardType="decimal-pad"
                      accessibilityLabel={t('workout.kg')}
                      onChangeText={(value) =>
                        store.updateSet(exercise.localId, set.localId, { weightKg: value })
                      }
                    />
                  ) : null}
                  {exercise.exerciseType === 'strength' ||
                  exercise.exerciseType === 'bodyweight' ? (
                    <SetMetricField
                      unit={t('workout.reps')}
                      value={set.reps}
                      keyboardType="number-pad"
                      accessibilityLabel={t('workout.reps')}
                      onChangeText={(value) =>
                        store.updateSet(exercise.localId, set.localId, { reps: value })
                      }
                    />
                  ) : null}
                  {exercise.exerciseType === 'cardio' || exercise.exerciseType === 'other' ? (
                    <SetMetricField
                      unit={t('workout.sec')}
                      value={set.durationSec}
                      keyboardType="number-pad"
                      accessibilityLabel={t('workout.sec')}
                      onChangeText={(value) =>
                        store.updateSet(exercise.localId, set.localId, { durationSec: value })
                      }
                    />
                  ) : null}
                  {exercise.exerciseType === 'cardio' ? (
                    <SetMetricField
                      unit={t('workout.meters')}
                      value={set.distanceM}
                      keyboardType="decimal-pad"
                      accessibilityLabel={t('workout.meters')}
                      onChangeText={(value) =>
                        store.updateSet(exercise.localId, set.localId, { distanceM: value })
                      }
                    />
                  ) : null}
                  {exercise.sets.length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('workout.deleteSet')}
                      onPress={() => store.removeSet(exercise.localId, set.localId)}
                      style={{
                        width: 36,
                        height: 56,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radii.md,
                        backgroundColor: colors.surfaceMuted,
                      }}
                    >
                      <Trash2 size={iconSizes.sm} color={colors.error} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => store.addSet(exercise.localId)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[1],
                alignSelf: 'flex-start',
                paddingVertical: spacing[1],
              }}
            >
              <Plus size={16} color={scheme === 'dark' ? colors.primary : colors.textPrimary} />
              <Text
                variant="bodyStrong"
                style={{ color: scheme === 'dark' ? colors.primary : colors.textPrimary }}
              >
                {t('workout.addSet')}
              </Text>
            </Pressable>
            {index === store.exercises.length - 1 ? null : null}
          </Card>
        ))}

        <Button
          label={t('workout.finish')}
          onPress={() => {
            void onFinish();
          }}
          loading={finish.isPending}
          disabled={finish.isPending || store.exercises.length === 0}
        />
      </View>
    </Screen>
  );
}

/** Owns the 1s tick so set metric TextInputs are not re-rendered every second. */
function ActiveElapsedLabel({ paused }: { paused: boolean }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { scheme } = useTheme();
  const getActiveDurationSec = useActiveWorkoutStore((state) => state.getActiveDurationSec);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  void nowMs;
  const elapsed = getActiveDurationSec();

  return (
    <Text
      style={{
        fontFamily: fonts.monoBold,
        fontSize: 28,
        lineHeight: 34,
        color: scheme === 'dark' ? colors.primary : colors.textPrimary,
      }}
    >
      {formatElapsed(elapsed)}
      {paused ? ` · ${t('workout.paused')}` : ''}
    </Text>
  );
}

function ActiveRestBanner() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const restEndsAt = useActiveWorkoutStore((state) => state.restEndsAt);
  const adjustRest = useActiveWorkoutStore((state) => state.adjustRest);
  const clearRest = useActiveWorkoutStore((state) => state.clearRest);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!restEndsAt) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [restEndsAt]);

  useEffect(() => {
    if (!restEndsAt) return;
    const left = Math.ceil((new Date(restEndsAt).getTime() - nowMs) / 1000);
    if (left <= 0) clearRest();
  }, [nowMs, restEndsAt, clearRest]);

  if (!restEndsAt) return null;

  const restLeft = Math.max(0, Math.ceil((new Date(restEndsAt).getTime() - nowMs) / 1000));
  if (restLeft <= 0) return null;

  return (
    <Card
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        backgroundColor: colors.primaryMuted,
        borderColor: colors.primary,
      }}
    >
      <TimerReset size={20} color={colors.primary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" tone="secondary">
          {t('workout.restTimer')}
        </Text>
        <Text
          style={{
            fontFamily: fonts.monoBold,
            fontSize: 24,
            lineHeight: 30,
            color: colors.textPrimary,
          }}
        >
          {formatElapsed(restLeft)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.restMinus')}
        onPress={() => adjustRest(-15)}
        hitSlop={8}
      >
        <Text variant="caption" tone="secondary">
          {t('workout.restMinus')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.restPlus')}
        onPress={() => adjustRest(15)}
        hitSlop={8}
      >
        <Text variant="caption" tone="secondary">
          {t('workout.restPlus')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.skipRest')}
        onPress={() => clearRest()}
        hitSlop={8}
      >
        <Text variant="bodyStrong">{t('workout.skipRest')}</Text>
      </Pressable>
    </Card>
  );
}

function ActiveExerciseThumb({ exercise }: { exercise: DraftExercise }) {
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  const resolved = resolveExerciseImage({
    imageUrl: exercise.imageUrl,
    imageStoragePath: exercise.imageStoragePath,
    imageKey: exercise.imageKey,
    slug: exercise.slug,
    name: exercise.name,
  });
  const source = failed ? EXERCISE_IMAGE_PLACEHOLDER : resolved;

  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: radii.md,
        overflow: 'hidden',
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Image
        source={source}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        recyclingKey={exercise.localId}
        transition={0}
        cachePolicy="memory-disk"
        onError={() => setFailed(true)}
      />
    </View>
  );
}
