import { differenceInMinutes, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { ChevronDown, ChevronUp, Dumbbell, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ExerciseArtwork } from '@/features/workout/components/exercise-artwork';
import type { WorkoutListItem } from '@/features/workout/hooks';
import { resolveWorkoutName } from '@/features/workout/session-display';
import { iconSizes, radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type WorkoutSectionProps = {
  workouts: WorkoutListItem[];
  locale: string;
  onAdd: () => void;
};

function durationMinutes(workout: WorkoutListItem): number | null {
  if (workout.active_duration_sec != null && workout.active_duration_sec > 0) {
    return Math.max(1, Math.round(workout.active_duration_sec / 60));
  }
  if (!workout.ended_at) return null;
  return Math.max(0, differenceInMinutes(parseISO(workout.ended_at), parseISO(workout.started_at)));
}

export function WorkoutSection({ workouts, locale, onAdd }: WorkoutSectionProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [open, setOpen] = useState(true);
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const totalKcal = Math.round(
    workouts.reduce((sum, workout) => sum + Number(workout.estimated_calories ?? 0), 0),
  );

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={t('diary.workout.title')}
          onPress={() => setOpen((current) => !current)}
          className="min-w-0 flex-1 flex-row items-center gap-3"
        >
          <View
            className="items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.sm,
              backgroundColor: colors.primary,
            }}
          >
            <Dumbbell size={22} color={colors.textOnPrimary} strokeWidth={2.2} />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="headingSmall">{t('diary.workout.title')}</Text>
            <Text variant="headingMedium" tone="brand">
              {totalKcal} {t('diary.meals.kcalUnit')}
            </Text>
          </View>
          {open ? (
            <ChevronUp size={iconSizes.md} color={colors.textMuted} />
          ) : (
            <ChevronDown size={iconSizes.md} color={colors.textMuted} />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diary.workout.add')}
          onPress={onAdd}
          className="h-10 w-10 items-center justify-center"
          style={{
            backgroundColor: colors.primary,
            borderRadius: radii.pill,
          }}
        >
          <Plus size={20} color={colors.textOnPrimary} strokeWidth={2.5} />
        </Pressable>
      </View>

      {open ? (
        workouts.length === 0 ? (
          <View
            className="items-start gap-2 px-3 py-3"
            style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md }}
          >
            <Text variant="bodySmall" tone="muted">
              {t('diary.workout.emptyBody')}
            </Text>
            <Pressable accessibilityRole="button" onPress={onAdd}>
              <Text variant="label" tone="brand">
                {t('diary.workout.add')}
              </Text>
            </Pressable>
          </View>
        ) : (
          workouts.map((workout) => {
            const minutes = durationMinutes(workout);
            const kcal = Math.round(Number(workout.estimated_calories ?? 0));
            const exercises = (workout.previews ?? []).filter((row) => row.name.trim());
            const lead = exercises[0];
            const subtitle = [
              timeFmt.format(parseISO(workout.started_at)),
              minutes == null
                ? t('diary.workout.inProgress')
                : t('diary.workout.minutes', { value: minutes }),
              exercises.length > 0
                ? t('diary.workout.exercises', { count: exercises.length })
                : null,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <Pressable
                key={workout.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/workout/[id]', params: { id: workout.id } })
                }
                className="flex-row items-center gap-2.5 px-2.5 py-2"
                style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md }}
              >
                {lead ? (
                  <ExerciseArtwork
                    imageUrl={lead.image_url}
                    imageStoragePath={lead.image_storage_path}
                    imageKey={lead.image_key}
                    slug={lead.slug}
                    name={lead.name}
                    size={40}
                    recyclingKey={`${workout.id}-lead`}
                  />
                ) : (
                  <View
                    className="items-center justify-center"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radii.sm,
                      backgroundColor: colors.primary,
                    }}
                  >
                    <Dumbbell size={18} color={colors.textOnPrimary} />
                  </View>
                )}

                <View className="min-w-0 flex-1 gap-0.5">
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {resolveWorkoutName(workout.name, t('workout.defaultName'))}
                  </Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {subtitle}
                  </Text>
                </View>

                {kcal > 0 ? (
                  <Text variant="bodyStrong" tone="brand">
                    {kcal} {t('diary.meals.kcalUnit')}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )
      ) : null}
    </Card>
  );
}
