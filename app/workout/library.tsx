import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import {
  DIFFICULTY_FILTERS,
  EQUIPMENT_FILTERS,
  LIBRARY_TAXONOMY,
  isValidSubcategory,
  libraryPath,
  parseLibraryTop,
  type LibraryTopCategory,
} from '@/features/workout/catalog/library-taxonomy';
import { useLatestWeight } from '@/features/measurements/hooks';
import { getSubcategoryImage } from '@/features/workout/catalog/exercise-images';
import {
  EXERCISE_PREVIEW_DURATION_MIN,
  estimateExercisePreviewCalories,
} from '@/features/workout/calculations';
import { ExerciseListCard } from '@/features/workout/components/exercise-list-card';
import { TemplateCard } from '@/features/workout/components/template-card';
import { WorkoutFilterChip as FilterChip } from '@/features/workout/components/workout-filter-chip';
import {
  useExerciseFavorites,
  useExercises,
  useToggleExerciseFavorite,
  useWorkoutTemplates,
} from '@/features/workout/hooks';
import { getMuscleImage } from '@/features/workout/muscle-assets';
import type { Exercise } from '@/features/workout/types';
import { radii, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export default function WorkoutLibraryScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ top?: string; sub?: string }>();
  const top = parseLibraryTop(params.top);
  const sub =
    top && isValidSubcategory(top, params.sub) ? (params.sub as string) : null;

  if (!top) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <ErrorState
          title={t('workout.libraryError')}
          body={t('workout.retry')}
          onRetry={() => router.replace('/(tabs)/workout')}
        />
      </Screen>
    );
  }

  if (!sub) {
    return <SubcategoryPicker top={top} />;
  }

  return <ExerciseLibrary top={top} sub={sub} />;
}

function SubcategoryPicker({ top }: { top: LibraryTopCategory }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const templates = useWorkoutTemplates();
  const [templateDifficulty, setTemplateDifficulty] = useState<string | null>(null);
  const subs = LIBRARY_TAXONOMY[top];
  const categoryTemplates = useMemo(() => {
    const list = (templates.data ?? []).filter((item) => item.category === top);
    if (!templateDifficulty) return list;
    return list.filter((item) => item.difficulty === templateDifficulty);
  }, [templates.data, top, templateDifficulty]);

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-4">
        <View className="flex-row items-start gap-3">
          <ChromeIconButton
            header
            label={t('workout.back')}
            onPress={() => router.back()}
            icon={(color) => <ChevronLeft size={22} color={color} />}
          />
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="headingLarge">{t(`workout.category.${top}`)}</Text>
            <Text variant="bodySmall" tone="secondary">
              {t(`workout.categorySubtitle.${top}`)}
            </Text>
          </View>
        </View>

        <Text variant="label" tone="secondary">
          {t('workout.subcategories')}
        </Text>
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          {subs.map((item) => {
            const cover =
              (top === 'Strength' ? getMuscleImage(item.id) : null) ??
              getSubcategoryImage(libraryPath(top, item.id));
            const label = t(`workout.subcategory.${item.labelKey}`);
            return (
              <View key={item.id} style={{ width: '50%', padding: 6 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() =>
                    router.push({
                      pathname: '/workout/library',
                      params: { top, sub: item.id },
                    })
                  }
                  className="overflow-hidden"
                  style={
                    cover
                      ? {
                          height: 120,
                          borderRadius: radii.lg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }
                      : {
                          backgroundColor: colors.surfaceMuted,
                          borderRadius: radii.lg,
                          borderWidth: 1,
                          borderColor: colors.border,
                          minHeight: 72,
                          justifyContent: 'center',
                          paddingHorizontal: 12,
                          paddingVertical: 16,
                        }
                  }
                >
                  {cover
                    ? ({ pressed }) => (
                        <>
                          <Image
                            source={cover}
                            style={{
                              position: 'absolute',
                              width: '100%',
                              height: '100%',
                              transform: [{ scale: pressed ? 1.04 : 1 }],
                            }}
                            resizeMode="cover"
                            accessibilityIgnoresInvertColors
                          />
                          <View
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: 0,
                              bottom: 0,
                              backgroundColor: withAlpha('#000000', pressed ? 0.42 : 0.28),
                            }}
                          />
                          <View
                            className="flex-1 justify-end px-3"
                            style={{ paddingBottom: 14, paddingTop: 24 }}
                          >
                            <Text
                              variant="headingSmall"
                              numberOfLines={2}
                              style={{ color: '#FFFFFF' }}
                            >
                              {label}
                            </Text>
                          </View>
                        </>
                      )
                    : (
                        <Text variant="bodyStrong" numberOfLines={2}>
                          {label}
                        </Text>
                      )}
                </Pressable>
              </View>
            );
          })}
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="secondary">
              {t('workout.templates')}
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/workout/templates/create',
                  params: { category: top },
                })
              }
            >
              <Text variant="caption" tone="brand">
                {t('workout.createTemplate')}
              </Text>
            </Pressable>
          </View>
          <View className="gap-2">
            <Text variant="label" tone="secondary">
              {t('workout.difficultyLabel')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <FilterChip
                label={t('workout.filterAll')}
                selected={templateDifficulty == null}
                onPress={() => setTemplateDifficulty(null)}
              />
              {DIFFICULTY_FILTERS.map((level) => (
                <FilterChip
                  key={level}
                  label={t(`workout.difficulty.${level}`)}
                  selected={templateDifficulty === level}
                  onPress={() =>
                    setTemplateDifficulty((current) => (current === level ? null : level))
                  }
                />
              ))}
            </View>
          </View>
          {templates.isPending && !templates.data ? <LoadingState /> : null}
          {!templates.isPending && categoryTemplates.length === 0 ? (
            <Text variant="bodySmall" tone="muted">
              {t('workout.templatesEmptyFilter')}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
            {categoryTemplates.map((template) => (
              <View key={template.id} style={{ width: '50%', padding: 6 }}>
                <TemplateCard
                  template={template}
                  onPress={() =>
                    router.push({
                      pathname: '/workout/templates/[id]',
                      params: { id: template.id },
                    })
                  }
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

function ExerciseLibrary({ top, sub }: { top: LibraryTopCategory; sub: string }) {
  const { t } = useTranslation();
  const path = libraryPath(top, sub);
  const [term, setTerm] = useState('');
  const deferredTerm = useDeferredValue(term);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const favorites = useExerciseFavorites();
  const toggleFavorite = useToggleExerciseFavorite();
  const weight = useLatestWeight();
  const favoriteIds = useMemo(() => new Set(favorites.data ?? []), [favorites.data]);

  // One stable query per subcategory — filter chips/search are client-side so the list
  // does not refetch / remount (that was the tab flicker + white image crossfade).
  const exercises = useExercises({ libraryPath: path });

  const filtered = useMemo(() => {
    let list = exercises.data ?? [];
    const q = deferredTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }
    if (equipment) {
      list = list.filter((item) => (item.equipment ?? 'none') === equipment);
    }
    if (difficulty) {
      list = list.filter((item) => item.difficulty === difficulty);
    }
    return [...list].sort((a, b) => {
      const af = favoriteIds.has(a.id) ? 0 : 1;
      const bf = favoriteIds.has(b.id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
  }, [exercises.data, deferredTerm, equipment, difficulty, favoriteIds]);

  const onToggleFavorite = useCallback(
    (exercise: Exercise, favorite: boolean) => {
      void toggleFavorite.mutateAsync({
        exerciseId: exercise.id,
        favorite: !favorite,
      });
    },
    [toggleFavorite],
  );

  const subMeta = LIBRARY_TAXONOMY[top].find((item) => item.id === sub);
  const title = subMeta ? t(`workout.subcategory.${subMeta.labelKey}`) : sub;
  const showInitialLoading = exercises.isPending && !exercises.data;

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View className="min-h-0 flex-1 gap-3">
        <View className="flex-row items-start gap-3">
          <ChromeIconButton
            header
            label={t('workout.back')}
            onPress={() => router.back()}
            icon={(color) => <ChevronLeft size={22} color={color} />}
          />
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="headingLarge">{title}</Text>
            <Text variant="bodySmall" tone="secondary">
              {t(`workout.category.${top}`)}
              {exercises.data
                ? ` · ${t('workout.resultCount', { count: filtered.length })}`
                : ''}
            </Text>
          </View>
        </View>

        <Input
          label={t('workout.search')}
          value={term}
          onChangeText={setTerm}
          autoCapitalize="none"
        />

        <View className="gap-3.5">
          <View className="gap-2">
            <Text variant="label" tone="secondary">
              {t('workout.equipmentLabel')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <FilterChip
                label={t('workout.filterAll')}
                selected={equipment == null}
                onPress={() => setEquipment(null)}
              />
              {EQUIPMENT_FILTERS.map((item) => (
                <FilterChip
                  key={item}
                  label={t(`workout.equipment.${item}`, { defaultValue: item })}
                  selected={equipment === item}
                  onPress={() => setEquipment(equipment === item ? null : item)}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Text variant="label" tone="secondary">
              {t('workout.difficultyLabel')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <FilterChip
                label={t('workout.filterAll')}
                selected={difficulty == null}
                onPress={() => setDifficulty(null)}
              />
              {DIFFICULTY_FILTERS.map((item) => (
                <FilterChip
                  key={item}
                  label={t(`workout.difficulty.${item}`)}
                  selected={difficulty === item}
                  onPress={() => setDifficulty(difficulty === item ? null : item)}
                />
              ))}
            </View>
          </View>
        </View>

        <Button
          label={t('workout.createCustom')}
          onPress={() => router.push('/workout/exercises/create')}
        />

        {showInitialLoading ? <LoadingState /> : null}
        {exercises.error ? (
          <ErrorState
            title={t('workout.libraryError')}
            body={
              exercises.error instanceof Error ? exercises.error.message : t('workout.retry')
            }
            onRetry={() => void exercises.refetch()}
          />
        ) : null}

        {!showInitialLoading ? (
          <FlatList
            className="flex-1"
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 10, paddingBottom: 32 }}
            initialNumToRender={12}
            windowSize={7}
            removeClippedSubviews={false}
            ListEmptyComponent={
              <View className="gap-3">
                <EmptyState
                  title={t('workout.noExercises')}
                  body={t('workout.noExercisesBody')}
                />
                <Button
                  label={t('workout.createCustom')}
                  onPress={() => router.push('/workout/exercises/create')}
                />
              </View>
            }
            renderItem={({ item }) => {
              const fav = favoriteIds.has(item.id);
              const preview =
                weight.weightKg && weight.weightKg > 0
                  ? estimateExercisePreviewCalories({
                      exerciseType: item.exercise_type,
                      metValue: item.met_value,
                      name: item.name,
                      bodyWeightKg: weight.weightKg,
                    })
                  : null;
              return (
                <ExerciseListCard
                  exercise={item}
                  favorite={fav}
                  estimatedKcal={preview?.estimatedCalories ?? null}
                  estimateMinutes={preview?.durationMin ?? EXERCISE_PREVIEW_DURATION_MIN}
                  estimateActivityLabel={
                    preview && preview.evidence !== 'compendium_activity'
                      ? t(`workout.activityClass.${preview.activityLabelKey}`)
                      : null
                  }
                  onToggleFavorite={() => onToggleFavorite(item, fav)}
                  onPress={() =>
                    router.push({
                      pathname: '/workout/exercise/[id]',
                      params: { id: item.id },
                    })
                  }
                />
              );
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
