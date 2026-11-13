import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TemplateCard } from '@/features/workout/components/template-card';
import { WorkoutFilterChip } from '@/features/workout/components/workout-filter-chip';
import { useWorkoutTemplates } from '@/features/workout/hooks';
import type { ExerciseDifficulty } from '@/features/workout/types';

const DIFFICULTIES: (ExerciseDifficulty | 'all')[] = [
  'all',
  'beginner',
  'intermediate',
  'advanced',
];

export default function WorkoutTemplatesScreen() {
  const { t } = useTranslation();
  const templates = useWorkoutTemplates();
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty | 'all'>('all');

  const filtered = useMemo(() => {
    const list = templates.data ?? [];
    if (difficulty === 'all') return list;
    return list.filter((row) => row.difficulty === difficulty);
  }, [templates.data, difficulty]);

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="headingLarge">{t('workout.templates')}</Text>
            <Text variant="bodySmall" tone="secondary">
              {t('workout.templatesEntryBody')}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text variant="bodyStrong" tone="secondary">
              {t('workout.back')}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {DIFFICULTIES.map((item) => (
            <WorkoutFilterChip
              key={item}
              selected={difficulty === item}
              onPress={() => setDifficulty(item)}
              label={
                item === 'all' ? t('workout.filterAll') : t(`workout.difficulty.${item}`)
              }
            />
          ))}
        </View>

        <Button
          label={t('workout.createTemplate')}
          variant="secondary"
          onPress={() => router.push('/workout/templates/create')}
        />

        {templates.isLoading ? <LoadingState /> : null}
        {templates.error ? (
          <ErrorState
            title={t('workout.templatesError')}
            body={templates.error instanceof Error ? templates.error.message : t('workout.retry')}
            onRetry={() => void templates.refetch()}
          />
        ) : null}
        {!templates.isLoading && !templates.error && filtered.length === 0 ? (
          <EmptyState
            title={t('workout.templatesEmptyFilter')}
            body={t('workout.templatesEntryBody')}
          />
        ) : null}

        <View className="gap-3">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              wide
              onPress={() =>
                router.push({
                  pathname: '/workout/templates/[id]',
                  params: { id: template.id },
                })
              }
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
