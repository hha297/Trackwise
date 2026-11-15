import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TemplateExerciseRow } from '@/features/workout/components/template-exercise-row';
import {
  useTemplateVariations,
  useWorkoutTemplates,
} from '@/features/workout/hooks';
import { getTemplateCover } from '@/features/workout/template-assets';
import {
  localizedEquipmentSummary,
  localizedTemplateDescription,
  localizedTemplateName,
  localizedVariationDescription,
} from '@/features/workout/template-i18n';
import type { ExerciseDifficulty, WorkoutTemplateVariation } from '@/features/workout/types';
import { TEMPLATE_TRAINING_LEVELS } from '@/features/workout/types';
import { useActiveWorkoutStore } from '@/stores/active-workout-store';
import { radii, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export default function WorkoutTemplateDetailScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const templates = useWorkoutTemplates();
  const variationsQuery = useTemplateVariations(id ?? null);
  const start = useActiveWorkoutStore((state) => state.start);

  const template = (templates.data ?? []).find((item) => item.id === id) ?? null;
  const variations = useMemo(
    () =>
      (variationsQuery.data ?? []).filter(
        (item) => (item.exercises?.length ?? item.exercise_count ?? 0) > 0,
      ),
    [variationsQuery.data],
  );

  const [selectedLevel, setSelectedLevel] = useState<ExerciseDifficulty | null>(null);

  const preferredLevel = useMemo(() => {
    if (!variations.length) return null;
    return (
      (template?.difficulty as ExerciseDifficulty | undefined) ??
      TEMPLATE_TRAINING_LEVELS.find((level) =>
        variations.some((item) => item.training_level === level),
      ) ??
      variations[0]?.training_level ??
      null
    );
  }, [template?.difficulty, variations]);

  const effectiveLevel =
    selectedLevel && variations.some((item) => item.training_level === selectedLevel)
      ? selectedLevel
      : preferredLevel;

  const selectedVariation: WorkoutTemplateVariation | null =
    variations.find((item) => item.training_level === effectiveLevel) ?? variations[0] ?? null;
  const list = selectedVariation?.exercises ?? [];
  const totalSets = list.reduce((sum, row) => sum + (row.planned_sets ?? 0), 0);
  const minutes = selectedVariation?.estimated_minutes ?? null;

  if (
    templates.isLoading ||
    (id && variationsQuery.isLoading && !variationsQuery.data)
  ) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!template) {
    return (
      <Screen>
        <ErrorState
          title={t('workout.templatesError')}
          body={t('workout.retry')}
          onRetry={() => void templates.refetch()}
        />
      </Screen>
    );
  }

  const cover = getTemplateCover(template);
  const overviewParts: string[] = [];
  if (template.goal) {
    overviewParts.push(
      t(`workout.templateGoal.${template.goal}`, { defaultValue: String(template.goal) }),
    );
  }
  overviewParts.push(template.is_system ? t('workout.systemTemplate') : t('workout.custom'));
  if (variations.length) {
    overviewParts.push(t('workout.templateLevelCount', { count: variations.length }));
  }

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-4">
        <View className="flex-row items-start gap-3">
          <ChromeIconButton
            header
            label={t('workout.close')}
            onPress={() => router.back()}
            icon={(color) => <X size={22} color={color} />}
          />
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="headingLarge" numberOfLines={2}>
              {localizedTemplateName(t, template.name, { isSystem: template.is_system })}
            </Text>
            <Text variant="caption" tone="secondary">
              {overviewParts.join(' · ')}
            </Text>
          </View>
          {!template.is_system ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/workout/templates/create',
                  params: { id: template.id },
                })
              }
            >
              <Text variant="bodyStrong" tone="brand">
                {t('workout.editTemplate')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View
          style={{
            width: '100%',
            height: 188,
            borderRadius: radii.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Image
            source={cover}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </View>

        <Text variant="bodySmall" tone="secondary">
          {localizedTemplateDescription(t, template.name, template.description, {
            isSystem: template.is_system,
          }) || t('workout.templateOverviewFallback')}
        </Text>

        {template.equipment_summary ? (
          <View className="gap-1">
            <Text variant="label" tone="secondary">
              {t('workout.equipmentLabel')}
            </Text>
            <Text variant="bodySmall" tone="secondary">
              {localizedEquipmentSummary(t, template.equipment_summary, {
                isSystem: template.is_system,
              })}
            </Text>
          </View>
        ) : null}

        <Text variant="label" tone="secondary">
          {t('workout.templateTrainingLevels')}
        </Text>

        {variationsQuery.error ? (
          <ErrorState
            title={t('workout.templatesError')}
            body={
              variationsQuery.error instanceof Error
                ? variationsQuery.error.message
                : t('workout.retry')
            }
            onRetry={() => void variationsQuery.refetch()}
          />
        ) : null}

        {!variations.length && !variationsQuery.isLoading ? (
          <Text variant="bodySmall" tone="muted">
            {t('workout.templateEmptyExercises')}
          </Text>
        ) : null}

        <View className="gap-2">
          {variations.map((variation) => {
            const selected = selectedVariation?.id === variation.id;
            const count = variation.exercise_count ?? variation.exercises?.length ?? 0;
            const sets =
              variation.total_sets ??
              (variation.exercises ?? []).reduce((sum, row) => sum + (row.planned_sets ?? 0), 0);
            return (
              <Pressable
                key={variation.id}
                onPress={() => setSelectedLevel(variation.training_level)}
                style={{
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected
                    ? withAlpha(colors.primary, 0.12)
                    : colors.surface,
                  borderRadius: radii.md,
                  padding: 12,
                  gap: 4,
                }}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text variant="bodyStrong">
                    {t(`workout.difficulty.${variation.training_level}`)}
                  </Text>
                  {variation.estimated_minutes ? (
                    <Text variant="caption" tone="brand">
                      {t('workout.templateMinutes', { count: variation.estimated_minutes })}
                    </Text>
                  ) : null}
                </View>
                {variation.description ? (
                  <Text variant="caption" tone="secondary" numberOfLines={2}>
                    {localizedVariationDescription(
                      t,
                      template.name,
                      variation.training_level,
                      variation.description,
                      { isSystem: template.is_system },
                    )}
                  </Text>
                ) : (
                  <Text variant="caption" tone="muted">
                    {t(`workout.templateLevelBlurb.${variation.training_level}`)}
                  </Text>
                )}
                <Text variant="caption" tone="secondary">
                  {t('workout.templateLevelSummary', {
                    count,
                    minutes: variation.estimated_minutes ?? '—',
                  })}
                  {sets ? ` · ${t('workout.templateTotalSets', { count: sets })}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedVariation ? (
          <>
            <Text variant="label" tone="secondary">
              {t('workout.templateExercises')}
              {minutes ? ` · ${t('workout.templateMinutes', { count: minutes })}` : ''}
              {totalSets ? ` · ${t('workout.templateTotalSets', { count: totalSets })}` : ''}
            </Text>

            <View className="gap-2">
              {list.map((row, index) => (
                <TemplateExerciseRow
                  key={row.id}
                  exercise={row}
                  index={index}
                  isSystem={template.is_system}
                  showImage
                  onPress={
                    row.exercise_id
                      ? () =>
                          router.push({
                            pathname: '/workout/exercise/[id]',
                            params: { id: row.exercise_id! },
                          })
                      : undefined
                  }
                />
              ))}
            </View>
          </>
        ) : null}

        <Button
          label={t('workout.startTemplate')}
          disabled={!list.length || variationsQuery.isLoading}
          onPress={() => {
            if (!selectedVariation || !list.length) return;
            start({
              name: `${localizedTemplateName(t, template.name, { isSystem: template.is_system })} · ${t(`workout.difficulty.${selectedVariation.training_level}`)}`,
              sourceTemplateId: template.id,
              exercises: list.map((row) => ({
                exerciseId: row.exercise_id,
                name: row.exercise_name,
                exerciseType: row.exercise_type,
                metValue: null,
                plannedSets: row.planned_sets,
                plannedReps: row.planned_reps,
                imageUrl: row.image_url,
                imageStoragePath: row.image_storage_path,
                imageKey: row.image_key,
                slug: row.slug,
                primaryMuscles: row.primary_muscles ?? undefined,
              })),
            });
            router.push('/workout/active');
          }}
        />
      </View>
    </Screen>
  );
}

