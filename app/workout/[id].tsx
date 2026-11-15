import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { resolveExerciseImage } from '@/features/workout/catalog/exercise-images';
import { SortableSetList } from '@/features/workout/components/draggable-set-row';
import { SetMetricField, SetMetricReadout } from '@/features/workout/components/set-metric-field';
import {
  formatElapsed,
  useDeleteWorkout,
  useRenameWorkout,
  useReorderSavedSets,
  useReviseSavedSet,
  useWorkoutDetail,
} from '@/features/workout/hooks';
import { formatWorkoutDay, resolveWorkoutName } from '@/features/workout/session-display';
import { layout, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { useActiveWorkoutStore } from '@/stores/active-workout-store';

export default function WorkoutDetailScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useWorkoutDetail(id ?? null);
  const remove = useDeleteWorkout();
  const rename = useRenameWorkout();
  const start = useActiveWorkoutStore((state) => state.start);
  const revise = useReviseSavedSet();
  const reorder = useReorderSavedSets();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [setOrderByExercise, setSetOrderByExercise] = useState<Record<string, string[]>>({});
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    weight: '',
    reps: '',
    duration: '',
    distance: '',
  });
  const [focusField, setFocusField] = useState<'weight' | 'reps' | 'duration' | 'distance' | null>(
    null,
  );
  const draftRef = useRef(draft);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nameDraft, setNameDraft] = useState<{ id: string; name: string } | null>(null);
  const name =
    nameDraft && nameDraft.id === detail.data?.id ? nameDraft.name : (detail.data?.name ?? '');
  const nameDirty =
    Boolean(detail.data) &&
    name.trim().length > 0 &&
    name.trim() !== (detail.data?.name ?? '').trim();

  if (detail.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (detail.error || !detail.data) {
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

  const workout = detail.data;

  const loggedNumber = (value: string) => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const saveSet = (setId: string) => {
    const owner = workout.exercises.find((item) => item.sets.some((set) => set.id === setId));
    if (!owner) return;
    const values = draftRef.current;
    const showStrength = owner.exercise_type === 'strength';
    const showReps = owner.exercise_type === 'strength' || owner.exercise_type === 'bodyweight';
    const showDuration = owner.exercise_type === 'cardio' || owner.exercise_type === 'other';
    const showDistance = owner.exercise_type === 'cardio';
    void revise
      .mutateAsync({
        workoutId: workout.id,
        setId,
        mode: 'update',
        weightKg: showStrength ? loggedNumber(values.weight) : null,
        reps: showReps ? loggedNumber(values.reps) : null,
        durationSec: showDuration ? loggedNumber(values.duration) : null,
        distanceM: showDistance ? loggedNumber(values.distance) : null,
      })
      .catch((error: unknown) => {
        Alert.alert(
          t('workout.saveFailed'),
          error instanceof Error ? error.message : t('workout.retry'),
        );
      });
  };

  const openSet = (
    set: (typeof workout.exercises)[number]['sets'][number],
    field: 'weight' | 'reps' | 'duration' | 'distance',
  ) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    if (editingSetId && editingSetId !== set.id) saveSet(editingSetId);
    const next = {
      weight: set.weight_kg ? String(set.weight_kg) : '',
      reps: set.reps ? String(set.reps) : '',
      duration: set.duration_sec ? String(set.duration_sec) : '',
      distance: set.distance_m ? String(set.distance_m) : '',
    };
    draftRef.current = next;
    setDraft(next);
    setFocusField(field);
    setEditingSetId(set.id);
  };

  const updateDraft = (patch: Partial<typeof draft>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
  };

  const scheduleSave = (setId: string) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      // mutateAsync runs onMutate sync (optimistic cache) before we leave edit mode,
      // so readout never flashes the previous weight/reps.
      saveSet(setId);
      setEditingSetId((current) => (current === setId ? null : current));
    }, 160);
  };

  const saveName = () => {
    if (!nameDirty || rename.isPending) return;
    void rename
      .mutateAsync({ id: workout.id, name })
      .then(() => setNameDraft(null))
      .catch((error: unknown) => {
        Alert.alert(
          t('workout.saveFailed'),
          error instanceof Error ? error.message : t('workout.retry'),
        );
      });
  };

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: 12 }}>
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="headingLarge" className="min-w-0 flex-1" numberOfLines={2}>
            {resolveWorkoutName(workout.name, t('workout.defaultName'))}
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text variant="bodyStrong" tone="secondary">
              {t('workout.close')}
            </Text>
          </Pressable>
        </View>

        <Text variant="caption" tone="secondary">
          {formatWorkoutDay(workout.started_at)}
          {workout.active_duration_sec
            ? ` · ${formatElapsed(workout.active_duration_sec)}`
            : ''}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: spacing[2],
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Input
              label={t('workout.sessionName')}
              value={name}
              onChangeText={(value) => setNameDraft({ id: workout.id, name: value })}
              placeholder={t('workout.sessionNamePlaceholder')}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
          </View>
          {nameDirty ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workout.saveName')}
              disabled={rename.isPending}
              onPress={saveName}
              style={{
                width: layout.inputMinHeight,
                height: layout.inputMinHeight,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.md,
                backgroundColor: colors.primary,
                opacity: rename.isPending ? 0.7 : 1,
              }}
            >
              {rename.isPending ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Check size={22} color={colors.textOnPrimary} strokeWidth={2.75} />
              )}
            </Pressable>
          ) : null}
        </View>

        <Card className="gap-2">
          <Text variant="label" tone="secondary">
            {t('workout.estimatedCalories')}
          </Text>
          <Text variant="headingLarge" tone="brand">
            {t('workout.summaryCalories', {
              value: Math.round(Number(workout.estimated_calories ?? 0)),
            })}
          </Text>
          <Text variant="caption" tone="muted">
            {t('workout.sessionCaloriesSumNote')}
          </Text>
        </Card>

        {workout.exercises.map((exercise) => (
          <Card key={exercise.id} className="gap-2" style={{ padding: layout.cardPaddingDense }}>
            <View className="flex-row items-start justify-between gap-2">
              <Image
                source={resolveExerciseImage({
                  imageUrl: exercise.image_url,
                  imageStoragePath: exercise.image_storage_path,
                  imageKey: exercise.image_key,
                  slug: exercise.slug,
                  name: exercise.exercise_name,
                })}
                style={{ width: 64, height: 64, borderRadius: radii.md }}
                contentFit="cover"
              />
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="headingSmall">{exercise.exercise_name}</Text>
                <Text variant="caption" tone="secondary">
                  {t(`workout.type.${exercise.exercise_type}`)}
                </Text>
              </View>
            </View>
            {(() => {
              const logged = exercise.sets
                .filter((set) =>
                  [set.weight_kg, set.reps, set.duration_sec, set.distance_m].some(
                    (value) => value != null && Number(value) > 0,
                  ),
                )
                .sort((a, b) => a.set_number - b.set_number);
              const override = setOrderByExercise[exercise.id];
              const byId = new Map(logged.map((set) => [set.id, set]));
              const ordered =
                override &&
                override.every((id) => byId.has(id)) &&
                override.length === logged.length
                  ? override.map((id) => byId.get(id)!)
                  : logged;

              return (
                <SortableSetList
                  data={ordered}
                  keyExtractor={(set) => set.id}
                  disabled={revise.isPending || Boolean(editingSetId)}
                  dragLabel={t('workout.reorderSet')}
                  onReorder={(from, to) => {
                    const next = [...ordered];
                    const [row] = next.splice(from, 1);
                    if (!row) return;
                    next.splice(to, 0, row);
                    const orderedSetIds = next.map((item) => item.id);
                    setSetOrderByExercise((current) => ({
                      ...current,
                      [exercise.id]: orderedSetIds,
                    }));
                    void reorder
                      .mutateAsync({
                        workoutId: workout.id,
                        exerciseId: exercise.id,
                        orderedSetIds,
                      })
                      .then(() => {
                        // Optimistic cache already matches — drop local override quietly.
                        setSetOrderByExercise((current) => {
                          const copy = { ...current };
                          delete copy[exercise.id];
                          return copy;
                        });
                      })
                      .catch((error: unknown) => {
                        setSetOrderByExercise((current) => {
                          const copy = { ...current };
                          delete copy[exercise.id];
                          return copy;
                        });
                        Alert.alert(
                          t('workout.saveFailed'),
                          error instanceof Error ? error.message : t('workout.retry'),
                        );
                      });
                  }}
                  renderContent={(set) => {
                    const editing = editingSetId === set.id;
                    const showStrength = exercise.exercise_type === 'strength';
                    const showReps =
                      exercise.exercise_type === 'strength' ||
                      exercise.exercise_type === 'bodyweight';
                    const showDuration =
                      exercise.exercise_type === 'cardio' || exercise.exercise_type === 'other';
                    const showDistance = exercise.exercise_type === 'cardio';
                    const fieldEvents = {
                      onFocus: () => {
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                      },
                      onBlur: () => scheduleSave(set.id),
                    };
                    return (
                      <>
                        {showStrength ? (
                          editing ? (
                            <SetMetricField
                              compact
                              unit={t('workout.kg')}
                              value={draft.weight}
                              keyboardType="decimal-pad"
                              autoFocus={focusField === 'weight'}
                              onChangeText={(value) => updateDraft({ weight: value })}
                              {...fieldEvents}
                            />
                          ) : (
                            <SetMetricReadout
                              compact
                              unit={t('workout.kg')}
                              value={set.weight_kg ? String(set.weight_kg) : ''}
                              onPress={() => openSet(set, 'weight')}
                            />
                          )
                        ) : null}
                        {showReps ? (
                          editing ? (
                            <SetMetricField
                              compact
                              unit={t('workout.reps')}
                              value={draft.reps}
                              keyboardType="number-pad"
                              autoFocus={focusField === 'reps'}
                              onChangeText={(value) => updateDraft({ reps: value })}
                              {...fieldEvents}
                            />
                          ) : (
                            <SetMetricReadout
                              compact
                              unit={t('workout.reps')}
                              value={set.reps ? String(set.reps) : ''}
                              onPress={() => openSet(set, 'reps')}
                            />
                          )
                        ) : null}
                        {showDuration ? (
                          editing ? (
                            <SetMetricField
                              compact
                              unit={t('workout.sec')}
                              value={draft.duration}
                              keyboardType="number-pad"
                              autoFocus={focusField === 'duration'}
                              onChangeText={(value) => updateDraft({ duration: value })}
                              {...fieldEvents}
                            />
                          ) : (
                            <SetMetricReadout
                              compact
                              unit={t('workout.sec')}
                              value={set.duration_sec ? String(set.duration_sec) : ''}
                              onPress={() => openSet(set, 'duration')}
                            />
                          )
                        ) : null}
                        {showDistance ? (
                          editing ? (
                            <SetMetricField
                              compact
                              unit={t('workout.meters')}
                              value={draft.distance}
                              keyboardType="decimal-pad"
                              autoFocus={focusField === 'distance'}
                              onChangeText={(value) => updateDraft({ distance: value })}
                              {...fieldEvents}
                            />
                          ) : (
                            <SetMetricReadout
                              compact
                              unit={t('workout.meters')}
                              value={set.distance_m ? String(set.distance_m) : ''}
                              onPress={() => openSet(set, 'distance')}
                            />
                          )
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('workout.deleteSet')}
                          disabled={revise.isPending}
                          onPress={() => {
                            if (blurTimer.current) clearTimeout(blurTimer.current);
                            void revise
                              .mutateAsync({
                                workoutId: workout.id,
                                setId: set.id,
                                mode: 'delete',
                              })
                              .then(() => {
                                setEditingSetId((current) =>
                                  current === set.id ? null : current,
                                );
                                setSetOrderByExercise((current) => {
                                  const copy = { ...current };
                                  delete copy[exercise.id];
                                  return copy;
                                });
                              })
                              .catch((error: unknown) => {
                                Alert.alert(
                                  t('workout.saveFailed'),
                                  error instanceof Error ? error.message : t('workout.retry'),
                                );
                              });
                          }}
                          style={{
                            width: 36,
                            height: 44,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: radii.md,
                            backgroundColor: colors.surfaceMuted,
                          }}
                        >
                          <Trash2 size={16} color={colors.error} />
                        </Pressable>
                      </>
                    );
                  }}
                />
              );
            })()}
          </Card>
        ))}

        <Button
          label={t('workout.repeat')}
          onPress={() => {
            start({
              name: workout.name,
              exercises: workout.exercises.map((exercise) => ({
                exerciseId: exercise.exercise_id,
                name: exercise.exercise_name,
                exerciseType: exercise.exercise_type,
                metValue: null,
                imageUrl: exercise.image_url,
                imageStoragePath: exercise.image_storage_path,
                imageKey: exercise.image_key,
                slug: exercise.slug,
              })),
            });
            router.push('/workout/active');
          }}
        />
        <Button
          label={t('workout.delete')}
          variant="destructive"
          onPress={() => setDeleteOpen(true)}
        />
      </View>

      <DeleteConfirmDialog
        visible={deleteOpen}
        title={t('workout.deleteTitle')}
        body={t('workout.deleteBody')}
        cancelLabel={t('workout.keep')}
        confirmLabel={t('workout.delete')}
        loading={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          void remove.mutateAsync(workout.id).then(() => {
            setDeleteOpen(false);
            router.back();
          });
        }}
      />
    </Screen>
  );
}
