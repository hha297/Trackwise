import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Trash2,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import {
  EXERCISE_IMAGE_PLACEHOLDER,
  resolveExerciseImage,
} from '@/features/workout/catalog/exercise-images';
import { formatEquipmentLabel, formatMuscleList } from '@/features/workout/exercise-display';
import { estimateTemplateDurationMinutes } from '@/features/workout/calculations';
import {
  useCreateWorkoutTemplate,
  useExercises,
  useTemplateVariations,
  useUpdateWorkoutTemplate,
  useWorkoutTemplates,
} from '@/features/workout/hooks';
import type { Exercise, ExerciseDifficulty, ExerciseType, WorkoutTemplateGoal } from '@/features/workout/types';
import {
  TEMPLATE_EQUIPMENT_PRESETS,
  TEMPLATE_GOALS,
  TEMPLATE_TARGET_MUSCLES,
  TEMPLATE_TRAINING_LEVELS,
  WORKOUT_CATEGORIES,
} from '@/features/workout/types';
import { iconSizes, radii, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type DraftExercise = {
  key: string;
  exerciseId: string | null;
  name: string;
  exerciseType: ExerciseType;
  plannedSets: number;
  plannedReps: number | null;
  plannedRestSec: number;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageKey?: string | null;
  slug?: string | null;
  primaryMuscles?: string[];
  equipment?: string | null;
};

type LevelDraft = {
  enabled: boolean;
  description: string;
  estimatedMinutes: number | null;
  exercises: DraftExercise[];
};

function emptyLevel(enabled = false): LevelDraft {
  return { enabled, description: '', estimatedMinutes: null, exercises: [] };
}

function emptyLevels(): Record<ExerciseDifficulty, LevelDraft> {
  return {
    beginner: emptyLevel(false),
    intermediate: emptyLevel(true),
    advanced: emptyLevel(false),
  };
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function estimateMinutes(exercises: DraftExercise[]) {
  return estimateTemplateDurationMinutes(exercises);
}

function mapRowToDraft(row: {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  exercise_type: ExerciseType;
  planned_sets: number | null;
  planned_reps: number | null;
  planned_rest_sec?: number | null;
  image_url?: string | null;
  image_storage_path?: string | null;
  image_key?: string | null;
  slug?: string | null;
  primary_muscles?: string[] | null;
  equipment?: string | null;
}): DraftExercise {
  return {
    key: row.id,
    exerciseId: row.exercise_id,
    name: row.exercise_name,
    exerciseType: row.exercise_type,
    plannedSets: row.planned_sets ?? 3,
    plannedReps: row.planned_reps,
    plannedRestSec: row.planned_rest_sec ?? 60,
    imageUrl: row.image_url,
    imageStoragePath: row.image_storage_path,
    imageKey: row.image_key,
    slug: row.slug,
    primaryMuscles: row.primary_muscles ?? [],
    equipment: row.equipment,
  };
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      className="px-3 py-2"
      style={{
        borderRadius: radii.pill,
        backgroundColor: selected ? withAlpha(colors.primary, 0.16) : colors.surfaceMuted,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      <Text variant="caption" tone={selected ? 'brand' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="label" tone="secondary">
      {children}
    </Text>
  );
}

export default function CreateTemplateScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; id?: string }>();
  const editId = typeof params.id === 'string' ? params.id : null;
  const isEditing = Boolean(editId);

  const create = useCreateWorkoutTemplate();
  const update = useUpdateWorkoutTemplate();
  const templates = useWorkoutTemplates();
  const existingVariations = useTemplateVariations(editId);

  const initialCategory = WORKOUT_CATEGORIES.some((item) => item.id === params.category)
    ? (params.category as string)
    : 'Strength';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [goal, setGoal] = useState<WorkoutTemplateGoal | null>('general');
  const [equipment, setEquipment] = useState<string | null>('Full Gym');
  const [targetMuscles, setTargetMuscles] = useState<string[]>([]);
  const [levels, setLevels] = useState(emptyLevels);
  const [activeLevel, setActiveLevel] = useState<ExerciseDifficulty>('intermediate');
  const [hydrated, setHydrated] = useState(!isEditing);

  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);

  const catalog = useExercises({
    search: search.trim() || undefined,
    muscle: muscleFilter,
    enabled: true,
  });

  const activeDraft = levels[activeLevel];
  const draft = activeDraft.exercises;

  useEffect(() => {
    if (!isEditing || !editId || !templates.isFetched) return;
    const template = (templates.data ?? []).find((item) => item.id === editId);
    if (!template || template.is_system) {
      Alert.alert(t('workout.templatesError'), t('workout.templateEditForbidden'));
      router.back();
    }
  }, [editId, isEditing, t, templates.data, templates.isFetched]);

  if (
    isEditing &&
    editId &&
    !hydrated &&
    templates.isFetched &&
    existingVariations.isFetched
  ) {
    const template = (templates.data ?? []).find((item) => item.id === editId);
    if (template && !template.is_system) {
      const next = emptyLevels();
      for (const variation of existingVariations.data ?? []) {
        const level = variation.training_level;
        next[level] = {
          enabled: true,
          description: variation.description ?? '',
          estimatedMinutes: variation.estimated_minutes,
          exercises: (variation.exercises ?? []).map(mapRowToDraft),
        };
      }
      const firstConfigured =
        TEMPLATE_TRAINING_LEVELS.find(
          (level) => next[level].enabled && next[level].exercises.length,
        ) ?? 'intermediate';
      if (!TEMPLATE_TRAINING_LEVELS.some((level) => next[level].enabled)) {
        next.intermediate.enabled = true;
      }
      setName(template.name);
      setDescription(template.description ?? '');
      setCategory(template.category || 'Strength');
      setGoal((template.goal as WorkoutTemplateGoal) || 'general');
      setEquipment(template.equipment_summary || 'Full Gym');
      setTargetMuscles(template.target_muscles ?? []);
      setLevels(next);
      setActiveLevel(firstConfigured);
      setHydrated(true);
    }
  }

  const selectedIds = useMemo(
    () => new Set(draft.map((item) => item.exerciseId).filter(Boolean) as string[]),
    [draft],
  );

  const available = useMemo(() => {
    const list = catalog.data ?? [];
    return list.filter((item) => !selectedIds.has(item.id)).slice(0, 40);
  }, [catalog.data, selectedIds]);

  const minutes = activeDraft.estimatedMinutes ?? estimateMinutes(draft);
  const saving = create.isPending || update.isPending;

  function toggleMuscle(muscle: string) {
    setTargetMuscles((current) =>
      current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle],
    );
  }

  function patchActiveLevel(patch: Partial<LevelDraft>) {
    setLevels((current) => ({
      ...current,
      [activeLevel]: { ...current[activeLevel], ...patch },
    }));
  }

  function updateActiveExercises(updater: (exercises: DraftExercise[]) => DraftExercise[]) {
    setLevels((current) => ({
      ...current,
      [activeLevel]: {
        ...current[activeLevel],
        exercises: updater(current[activeLevel].exercises),
      },
    }));
  }

  function toggleLevelEnabled(level: ExerciseDifficulty) {
    setLevels((current) => {
      const enabledCount = TEMPLATE_TRAINING_LEVELS.filter((item) => current[item].enabled).length;
      const nextEnabled = !current[level].enabled;
      if (!nextEnabled && enabledCount <= 1) return current;
      return {
        ...current,
        [level]: { ...current[level], enabled: nextEnabled },
      };
    });
    setActiveLevel(level);
  }

  function addExercise(exercise: Exercise) {
    updateActiveExercises((current) => {
      if (current.some((item) => item.exerciseId === exercise.id)) return current;
      return [
        ...current,
        {
          key: newKey(),
          exerciseId: exercise.id,
          name: exercise.name,
          exerciseType: exercise.exercise_type,
          plannedSets: 3,
          plannedReps: 10,
          plannedRestSec: 60,
          imageUrl: exercise.image_url,
          imageStoragePath: exercise.image_storage_path,
          imageKey: exercise.image_key,
          slug: exercise.slug,
          primaryMuscles: exercise.primary_muscles ?? [],
          equipment: exercise.equipment,
        },
      ];
    });
    patchActiveLevel({ enabled: true });
  }

  function updateDraft(key: string, patch: Partial<DraftExercise>) {
    updateActiveExercises((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeDraft(key: string) {
    updateActiveExercises((current) => current.filter((item) => item.key !== key));
  }

  function moveDraft(key: string, direction: -1 | 1) {
    updateActiveExercises((current) => {
      const index = current.findIndex((item) => item.key === key);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(next, 0, row!);
      return copy;
    });
  }

  async function onSave() {
    if (!name.trim()) {
      Alert.alert(t('workout.templateNameRequired'));
      return;
    }
    const configured = TEMPLATE_TRAINING_LEVELS.filter(
      (level) => levels[level].enabled && levels[level].exercises.length > 0,
    );
    if (!configured.length) {
      Alert.alert(t('workout.templateNeedsExercises'));
      return;
    }

    const variations = configured.map((level) => {
      const item = levels[level];
      return {
        trainingLevel: level,
        description: item.description.trim() || null,
        estimatedMinutes: item.estimatedMinutes ?? estimateMinutes(item.exercises),
        exercises: item.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          exerciseType: exercise.exerciseType,
          plannedSets: exercise.plannedSets,
          plannedReps: exercise.plannedReps,
          plannedRestSec: exercise.plannedRestSec,
        })),
      };
    });

    const payload = {
      name: name.trim(),
      category,
      description: description.trim() || null,
      difficulty: configured[0] ?? activeLevel,
      goal,
      estimatedMinutes: variations[0]?.estimatedMinutes ?? null,
      equipmentSummary: equipment,
      targetMuscles,
      variations,
    };

    try {
      if (isEditing && editId) {
        await update.mutateAsync({ id: editId, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      router.back();
    } catch (error) {
      Alert.alert(
        t('workout.saveFailed'),
        error instanceof Error ? error.message : t('workout.retry'),
      );
    }
  }

  if (isEditing && !hydrated) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            gap: 20,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View className="flex-row items-center justify-between">
            <Text variant="headingLarge">
              {isEditing ? t('workout.editTemplate') : t('workout.createTemplate')}
            </Text>
            <Pressable onPress={() => router.back()}>
              <Text variant="bodyStrong" tone="secondary">
                {t('workout.close')}
              </Text>
            </Pressable>
          </View>

          <SectionLabel>{t('workout.templateInformation')}</SectionLabel>

          <Input
            label={t('workout.templateName')}
            value={name}
            onChangeText={setName}
            placeholder={t('workout.templateNamePlaceholder')}
          />
          <Input
            label={t('workout.descriptionOptional')}
            value={description}
            onChangeText={setDescription}
            placeholder={t('workout.templateDescriptionPlaceholder')}
            multiline
          />

          <View className="gap-2">
            <SectionLabel>{t('workout.categories')}</SectionLabel>
            <View className="flex-row flex-wrap gap-2">
              {WORKOUT_CATEGORIES.map((item) => (
                <Chip
                  key={item.id}
                  label={t(`workout.category.${item.id}`)}
                  selected={category === item.id}
                  onPress={() => setCategory(item.id)}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <SectionLabel>{t('workout.templateGoalLabel')}</SectionLabel>
            <View className="flex-row flex-wrap gap-2">
              {TEMPLATE_GOALS.map((item) => (
                <Chip
                  key={item}
                  label={t(`workout.templateGoal.${item}`)}
                  selected={goal === item}
                  onPress={() => setGoal(item)}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <SectionLabel>{t('workout.templateEquipmentLabel')}</SectionLabel>
            <View className="flex-row flex-wrap gap-2">
              {TEMPLATE_EQUIPMENT_PRESETS.map((item) => (
                <Chip
                  key={item}
                  label={t(`workout.templateEquipment.${item}`, { defaultValue: item })}
                  selected={equipment === item}
                  onPress={() => setEquipment(item)}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <SectionLabel>{t('workout.templateTargetMuscles')}</SectionLabel>
            <View className="flex-row flex-wrap gap-2">
              {TEMPLATE_TARGET_MUSCLES.map((item) => (
                <Chip
                  key={item}
                  label={t(`workout.muscle.${item}`, { defaultValue: item })}
                  selected={targetMuscles.includes(item)}
                  onPress={() => toggleMuscle(item)}
                />
              ))}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

          <SectionLabel>{t('workout.templateTrainingLevels')}</SectionLabel>
          <Text variant="caption" tone="muted">
            {t('workout.templateTrainingLevelsHint')}
          </Text>
          <View className="gap-2">
            {TEMPLATE_TRAINING_LEVELS.map((level) => {
              const item = levels[level];
              const selected = activeLevel === level;
              const configured = item.enabled && item.exercises.length > 0;
              return (
                <Pressable
                  key={level}
                  onPress={() => {
                    setActiveLevel(level);
                    if (!item.enabled) toggleLevelEnabled(level);
                  }}
                  style={{
                    borderWidth: selected ? 1.5 : 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected
                      ? withAlpha(colors.primary, 0.12)
                      : colors.surface,
                    borderRadius: radii.md,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text variant="bodyStrong">
                      {t(`workout.difficulty.${level}`)}
                    </Text>
                    <Pressable
                      onPress={() => toggleLevelEnabled(level)}
                      hitSlop={8}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: radii.pill,
                        backgroundColor: item.enabled
                          ? withAlpha(colors.primary, 0.2)
                          : colors.surfaceMuted,
                      }}
                    >
                      <Text variant="caption" tone={item.enabled ? 'brand' : 'muted'}>
                        {item.enabled
                          ? t('workout.templateLevelEnabled')
                          : t('workout.templateLevelEnable')}
                      </Text>
                    </Pressable>
                  </View>
                  <Text variant="caption" tone="secondary">
                    {configured
                      ? t('workout.templateLevelSummary', {
                          count: item.exercises.length,
                          minutes:
                            item.estimatedMinutes ?? estimateMinutes(item.exercises) ?? '—',
                        })
                      : t('workout.templateLevelEmpty')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            label={t('workout.templateLevelDescription')}
            value={activeDraft.description}
            onChangeText={(value) => patchActiveLevel({ description: value })}
            placeholder={t('workout.templateLevelDescriptionPlaceholder')}
            multiline
          />

          <View className="flex-row items-center justify-between">
            <SectionLabel>
              {t('workout.templateAddedExercises', { count: draft.length })}
            </SectionLabel>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: radii.pill,
                backgroundColor: withAlpha(colors.primary, 0.16),
              }}
            >
              <Text variant="caption" tone="brand">
                {t(`workout.difficulty.${activeLevel}`)} ·{' '}
                {t('workout.templateSelectedCount', { count: draft.length })}
              </Text>
            </View>
          </View>

          <View className="gap-2">
            {draft.map((item, index) => (
              <AddedExerciseRow
                key={item.key}
                item={item}
                index={index}
                canMoveUp={index > 0}
                canMoveDown={index < draft.length - 1}
                onChange={(patch) => updateDraft(item.key, patch)}
                onRemove={() => removeDraft(item.key)}
                onMoveUp={() => moveDraft(item.key, -1)}
                onMoveDown={() => moveDraft(item.key, 1)}
              />
            ))}
            {draft.length === 0 ? (
              <Text variant="bodySmall" tone="muted">
                {t('workout.templateEmptyExercises')}
              </Text>
            ) : null}
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

          <SectionLabel>
            {`${t('workout.templateAvailableExercises')} · ${t(`workout.difficulty.${activeLevel}`)}`}
          </SectionLabel>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: radii.md,
              paddingHorizontal: 12,
              minHeight: 44,
            }}
          >
            <Search color={colors.textMuted} size={iconSizes.sm} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('workout.search')}
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, color: colors.textPrimary, paddingVertical: 10 }}
            />
          </View>

          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t('workout.filterAll')}
              selected={muscleFilter == null}
              onPress={() => setMuscleFilter(null)}
            />
            {TEMPLATE_TARGET_MUSCLES.slice(0, 6).map((item) => (
              <Chip
                key={item}
                label={t(`workout.muscle.${item}`, { defaultValue: item })}
                selected={muscleFilter === item}
                onPress={() => setMuscleFilter((current) => (current === item ? null : item))}
              />
            ))}
          </View>

          <View className="gap-2">
            {catalog.isPending && !catalog.data ? <LoadingState /> : null}
            {available.map((exercise) => (
              <AvailableExerciseRow
                key={exercise.id}
                exercise={exercise}
                onAdd={() => addExercise(exercise)}
              />
            ))}
            {!catalog.isPending && available.length === 0 ? (
              <Text variant="bodySmall" tone="muted">
                {t('workout.templateNoAvailableExercises')}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            gap: 10,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text variant="bodySmall" tone="secondary">
              {t('workout.templateExerciseCount', { count: draft.length })}
            </Text>
            <Text variant="bodySmall" tone="brand">
              {minutes
                ? t('workout.templateMinutesEstimate', { count: minutes })
                : t('workout.templateMinutesPending')}
            </Text>
          </View>
          <Button
            label={isEditing ? t('workout.saveTemplateChanges') : t('workout.saveTemplate')}
            onPress={() => {
              void onSave();
            }}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function AvailableExerciseRow({
  exercise,
  onAdd,
}: {
  exercise: Exercise;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  const source = failed
    ? EXERCISE_IMAGE_PLACEHOLDER
    : resolveExerciseImage({
        imageUrl: exercise.image_url,
        imageStoragePath: exercise.image_storage_path,
        imageKey: exercise.image_key,
        slug: exercise.slug,
        name: exercise.name,
      });
  const muscles = formatMuscleList((exercise.primary_muscles ?? []).slice(0, 2), t);

  return (
    <View
      className="flex-row items-center gap-3"
      style={{
        padding: 10,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radii.sm,
          overflow: 'hidden',
          backgroundColor: colors.surfaceMuted,
        }}
      >
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="bodyStrong" numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {[muscles, exercise.equipment ? formatEquipmentLabel(exercise.equipment, t) : '']
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.templateAddExercise')}
        onPress={onAdd}
        hitSlop={8}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        }}
      >
        <Plus color={colors.textOnPrimary} size={20} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function AddedExerciseRow({
  item,
  index,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: DraftExercise;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (patch: Partial<DraftExercise>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  const source = failed
    ? EXERCISE_IMAGE_PLACEHOLDER
    : resolveExerciseImage({
        imageUrl: item.imageUrl,
        imageStoragePath: item.imageStoragePath,
        imageKey: item.imageKey,
        slug: item.slug,
        name: item.name,
      });

  return (
    <View
      style={{
        gap: 10,
        padding: 12,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: 4,
          }}
        >
          <Text variant="caption" tone="onPrimary">
            {index + 1}
          </Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.sm,
            overflow: 'hidden',
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Image
            source={source}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            onError={() => setFailed(true)}
          />
        </View>
        <Text variant="bodyStrong" className="min-w-0 flex-1" numberOfLines={2}>
          {item.name}
        </Text>
        <View className="flex-row items-center gap-1">
          <IconButton disabled={!canMoveUp} onPress={onMoveUp} label={t('workout.moveUp')}>
            <ChevronUp color={colors.textSecondary} size={18} />
          </IconButton>
          <IconButton disabled={!canMoveDown} onPress={onMoveDown} label={t('workout.moveDown')}>
            <ChevronDown color={colors.textSecondary} size={18} />
          </IconButton>
          <IconButton onPress={onRemove} label={t('workout.removeExercise')}>
            <Trash2 color={colors.error} size={18} />
          </IconButton>
        </View>
      </View>

      <View className="flex-row gap-2">
        <NumberField
          label={t('workout.templateFieldSets')}
          value={String(item.plannedSets)}
          onChange={(value) => {
            const next = Number(value.replace(/[^\d]/g, ''));
            if (!Number.isFinite(next) || next < 1) return;
            onChange({ plannedSets: Math.min(12, next) });
          }}
        />
        <NumberField
          label={t('workout.templateFieldReps')}
          value={item.plannedReps == null ? '' : String(item.plannedReps)}
          onChange={(value) => {
            if (!value) {
              onChange({ plannedReps: null });
              return;
            }
            const next = Number(value.replace(/[^\d]/g, ''));
            if (!Number.isFinite(next)) return;
            onChange({ plannedReps: Math.min(100, next) });
          }}
        />
        <NumberField
          label={t('workout.templateFieldRest')}
          value={String(item.plannedRestSec)}
          onChange={(value) => {
            const next = Number(value.replace(/[^\d]/g, ''));
            if (!Number.isFinite(next)) return;
            onChange({ plannedRestSec: Math.min(600, next) });
          }}
        />
      </View>
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <View className="min-w-0 flex-1 gap-1">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
          borderRadius: radii.sm,
          color: colors.textPrimary,
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
      />
    </View>
  );
}

function IconButton({
  children,
  onPress,
  disabled,
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.sm,
        opacity: disabled ? 0.35 : 1,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      {children}
    </Pressable>
  );
}
