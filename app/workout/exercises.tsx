import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Platform, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import {
  WORKOUT_CATEGORY_TAGS,
  WORKOUT_CATEGORY_TO_TYPE,
  WORKOUT_IMAGE_CATEGORIES,
  type ImageWorkoutCategory,
} from '@/features/workout/category-assets';
import { DIFFICULTY_FILTERS } from '@/features/workout/catalog/library-taxonomy';
import { useLatestWeight } from '@/features/measurements/hooks';
import {
  EXERCISE_PREVIEW_DURATION_MIN,
  estimateExercisePreviewCalories,
} from '@/features/workout/calculations';
import { ExerciseListCard } from '@/features/workout/components/exercise-list-card';
import { WorkoutFilterChip } from '@/features/workout/components/workout-filter-chip';
import {
  useExerciseFavorites,
  useExercises,
  useToggleExerciseFavorite,
} from '@/features/workout/hooks';
import { useActiveWorkoutStore } from '@/stores/active-workout-store';
import { useThemeColors } from '@/theme/theme-provider';
import type { Exercise, ExerciseDifficulty, ExerciseType } from '@/features/workout/types';

const IMAGE_CATEGORY_IDS = new Set<string>(WORKOUT_IMAGE_CATEGORIES);
const FILTERS: ('all' | ImageWorkoutCategory)[] = ['all', ...WORKOUT_IMAGE_CATEGORIES];
type CategoryFilter = 'all' | ImageWorkoutCategory;

function ItemSeparator() {
  return <View style={{ height: 8 }} />;
}

const FilterChip = WorkoutFilterChip;

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" tone="secondary">
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

const ExercisePickerRow = memo(function ExercisePickerRow({
  item,
  favorite,
  weightKg,
  browseMode,
  onOpen,
  onPick,
  onToggle,
}: {
  item: Exercise;
  favorite: boolean;
  weightKg: number | null;
  browseMode: boolean;
  onOpen: (exercise: Exercise) => void;
  onPick: (exercise: Exercise) => void;
  onToggle: (exercise: Exercise, favorite: boolean) => void;
}) {
  const { t } = useTranslation();
  const preview = useMemo(
    () =>
      weightKg && weightKg > 0
        ? estimateExercisePreviewCalories({
            exerciseType: item.exercise_type,
            metValue: item.met_value,
            name: item.name,
            bodyWeightKg: weightKg,
          })
        : null,
    [item.exercise_type, item.met_value, item.name, weightKg],
  );
  const onPress = useCallback(() => {
    if (browseMode) {
      onOpen(item);
      return;
    }
    try {
      onPick(item);
    } catch (error) {
      Alert.alert(
        t('workout.saveFailed'),
        error instanceof Error ? error.message : t('workout.retry'),
      );
    }
  }, [browseMode, item, onOpen, onPick, t]);

  return (
    <ExerciseListCard
      exercise={item}
      favorite={favorite}
      estimatedKcal={preview?.estimatedCalories ?? null}
      estimateMinutes={preview?.durationMin ?? EXERCISE_PREVIEW_DURATION_MIN}
      estimateActivityLabel={
        preview && preview.evidence !== 'compendium_activity'
          ? t(`workout.activityClass.${preview.activityLabelKey}`)
          : null
      }
      onToggleFavorite={() => onToggle(item, favorite)}
      onPress={onPress}
    />
  );
});

function parseCategory(value: string | undefined): CategoryFilter {
  if (value === 'all') return 'all';
  if (value && IMAGE_CATEGORY_IDS.has(value)) return value as ImageWorkoutCategory;
  // Always land on a populated list — empty chip-only UX looked broken.
  return 'Strength';
}

function typeForFilter(filter: CategoryFilter): ExerciseType | null {
  if (filter === 'all') return null;
  return WORKOUT_CATEGORY_TO_TYPE[filter];
}

export default function ExercisePickerScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ category?: string; mode?: string }>();
  /** Browse = open details only. Pick = add into the active workout (from Active). */
  const browseMode = params.mode !== 'pick';
  const [term, setTerm] = useState('');
  const deferredTerm = useDeferredValue(term);
  const [pickedCategory, setPickedCategory] = useState<CategoryFilter | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty | null>(null);

  const category = pickedCategory ?? parseCategory(
    typeof params.category === 'string' ? params.category : undefined,
  );
  const exerciseType = typeForFilter(category);
  const categoryTags =
    category !== 'all' ? WORKOUT_CATEGORY_TAGS[category] : null;

  // One query per type (or full catalog for All). Client filters handle search/tags.
  const exercises = useExercises({
    category: null,
    exerciseType,
    enabled: true,
  });
  const favorites = useExerciseFavorites();
  const toggleFavorite = useToggleExerciseFavorite();
  const weight = useLatestWeight();
  const favoriteIds = useMemo(() => new Set(favorites.data ?? []), [favorites.data]);

  const sorted = useMemo(() => {
    let list = exercises.data ?? [];
    const q = deferredTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((exercise) => exercise.name.toLowerCase().includes(q));
    }
    if (tag && categoryTags?.kind === 'equipment') {
      list = list.filter((exercise) => (exercise.equipment ?? 'none') === tag);
    }
    if (tag && categoryTags?.kind === 'muscle') {
      list = list.filter(
        (exercise) =>
          (exercise.primary_muscles ?? []).includes(tag) ||
          (exercise.secondary_muscles ?? []).includes(tag),
      );
    }
    if (difficulty) {
      list = list.filter((exercise) => exercise.difficulty === difficulty);
    }
    // Favorites first without re-sorting the whole name list every time when possible.
    const fav: Exercise[] = [];
    const rest: Exercise[] = [];
    for (const item of list) {
      (favoriteIds.has(item.id) ? fav : rest).push(item);
    }
    return fav.length ? fav.concat(rest) : list;
  }, [exercises.data, favoriteIds, categoryTags, tag, difficulty, deferredTerm]);

  const selectCategory = useCallback((next: CategoryFilter) => {
    setPickedCategory(next);
    setTag(null);
    router.setParams({ category: next });
  }, []);

  const openExercise = useCallback((exercise: Exercise) => {
    router.push({
      pathname: '/workout/exercise/[id]',
      params: { id: exercise.id },
    });
  }, []);

  const pickExercise = useCallback(
    (exercise: Exercise) => {
      const store = useActiveWorkoutStore.getState();
      if (!store.startedAt) {
        store.start({ name: t('workout.defaultName') });
      }
      store.addExercise({
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
      router.replace('/workout/active');
    },
    [t],
  );

  const onToggleFavorite = useCallback(
    (exercise: Exercise, favorite: boolean) => {
      void toggleFavorite.mutateAsync({
        exerciseId: exercise.id,
        favorite: !favorite,
      });
    },
    [toggleFavorite],
  );

  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExercisePickerRow
        item={item}
        favorite={favoriteIds.has(item.id)}
        weightKg={weight.weightKg ?? null}
        browseMode={browseMode}
        onOpen={openExercise}
        onPick={pickExercise}
        onToggle={onToggleFavorite}
      />
    ),
    [browseMode, favoriteIds, onToggleFavorite, openExercise, pickExercise, weight.weightKg],
  );

  const listHeader = useMemo(
    () => (
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text variant="headingLarge">
              {browseMode ? t('workout.exerciseLibrary') : t('workout.addExercise')}
            </Text>
            <Text variant="bodySmall" tone="secondary">
              {browseMode ? t('workout.exerciseLibraryBody') : t('workout.addExerciseHint')}
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text variant="bodyStrong" tone="secondary">
              {t('workout.done')}
            </Text>
          </Pressable>
        </View>

        <Input
          label={t('workout.search')}
          value={term}
          onChangeText={setTerm}
          autoCapitalize="none"
        />

        <View style={{ gap: 14 }}>
          <FilterSection title={t('workout.categoryLabel')}>
            {FILTERS.map((item) => {
              const selected = category === item;
              const label =
                item === 'all' ? t('workout.filterAll') : t(`workout.category.${item}`);
              return (
                <FilterChip
                  key={item}
                  label={label}
                  selected={selected}
                  onPress={() => selectCategory(item)}
                />
              );
            })}
          </FilterSection>

          {categoryTags ? (
            <FilterSection
              title={
                categoryTags.kind === 'muscle'
                  ? t('workout.musclesLabel')
                  : t('workout.equipmentLabel')
              }
            >
              <FilterChip
                label={t('workout.filterAll')}
                selected={tag == null}
                onPress={() => setTag(null)}
              />
              {categoryTags.values.map((value) => {
                const selected = tag === value;
                const label =
                  categoryTags.kind === 'muscle'
                    ? t(`workout.muscle.${value}`, { defaultValue: value })
                    : t(`workout.equipment.${value}`, { defaultValue: value });
                return (
                  <FilterChip
                    key={value}
                    label={label}
                    selected={selected}
                    onPress={() => setTag(selected ? null : value)}
                  />
                );
              })}
            </FilterSection>
          ) : null}

          <FilterSection title={t('workout.difficultyLabel')}>
            <FilterChip
              label={t('workout.filterAll')}
              selected={difficulty == null}
              onPress={() => setDifficulty(null)}
            />
            {DIFFICULTY_FILTERS.map((level) => (
              <FilterChip
                key={level}
                label={t(`workout.difficulty.${level}`)}
                selected={difficulty === level}
                onPress={() => setDifficulty(difficulty === level ? null : level)}
              />
            ))}
          </FilterSection>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Pressable onPress={() => router.push('/workout/exercises/create')}>
            <Text variant="caption" tone="brand">
              {t('workout.createCustom')}
            </Text>
          </Pressable>
          <Text variant="caption" tone="muted">
            ·
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/workout/templates/create',
                params: category === 'all' ? undefined : { category },
              })
            }
          >
            <Text variant="caption" tone="brand">
              {t('workout.createTemplate')}
            </Text>
          </Pressable>
        </View>

        {exercises.isPending && !exercises.data ? <LoadingState /> : null}
        {exercises.error ? (
          <ErrorState
            title={t('workout.libraryError')}
            body={
              exercises.error instanceof Error ? exercises.error.message : t('workout.retry')
            }
            onRetry={() => void exercises.refetch()}
          />
        ) : null}
      </View>
    ),
    [
      t,
      term,
      browseMode,
      category,
      categoryTags,
      tag,
      difficulty,
      selectCategory,
      exercises,
    ],
  );

  const showEmpty =
    !(exercises.isPending && !exercises.data) && !exercises.error && sorted.length === 0;

  return (
    <Screen keyboard edges={['top', 'bottom', 'left', 'right']}>
      <FlatList
        className="flex-1"
        data={sorted}
        keyExtractor={(item) => item.id}
        initialNumToRender={8}
        windowSize={5}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={50}
        extraData={favorites.data}
        removeClippedSubviews={Platform.OS === 'android'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          showEmpty ? (
            <View style={{ gap: 12 }}>
              <EmptyState title={t('workout.noExercises')} body={t('workout.noExercisesBody')} />
              <Button
                label={t('workout.createCustom')}
                onPress={() => router.push('/workout/exercises/create')}
              />
            </View>
          ) : undefined
        }
        renderItem={renderItem}
      />
    </Screen>
  );
}
