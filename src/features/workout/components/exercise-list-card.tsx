import { Star } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ExerciseArtwork } from '@/features/workout/components/exercise-artwork';
import {
  formatEquipmentLabel,
  formatMuscleList,
} from '@/features/workout/exercise-display';
import type { Exercise } from '@/features/workout/types';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type ExerciseListCardProps = {
  exercise: Exercise;
  onPress: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  /** Hide thumbnails when a larger image already appears above (avoids duplication). */
  showImage?: boolean;
  /** Net active kcal preview for a reference duration (null = weight missing). */
  estimatedKcal?: number | null;
  estimateMinutes?: number;
  /** When set, shows that kcal is a category proxy (e.g. resistance training), not a unique lift measurement. */
  estimateActivityLabel?: string | null;
};

function ExerciseListCardComponent({
  exercise,
  onPress,
  favorite = false,
  onToggleFavorite,
  showImage = true,
  estimatedKcal = null,
  estimateMinutes = 30,
  estimateActivityLabel = null,
}: ExerciseListCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const muscles = formatMuscleList((exercise.primary_muscles ?? []).slice(0, 2), t);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card className="flex-row items-center gap-3" style={{ padding: 10, position: 'relative' }}>
        {onToggleFavorite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite ? t('workout.favorited') : t('workout.favorite')}
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation?.();
              onToggleFavorite();
            }}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              zIndex: 2,
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Star
              size={18}
              color={favorite ? colors.warning : colors.textMuted}
              fill={favorite ? colors.warning : 'transparent'}
              strokeWidth={1.75}
            />
          </Pressable>
        ) : null}

        {showImage ? (
          <ExerciseArtwork
            imageUrl={exercise.image_url}
            imageStoragePath={exercise.image_storage_path}
            imageKey={exercise.image_key}
            slug={exercise.slug}
            name={exercise.name}
            size={72}
            recyclingKey={`${exercise.id}:${exercise.image_url ?? ''}`}
          />
        ) : null}

        <View
          className="min-w-0 flex-1 gap-0.5"
          style={onToggleFavorite ? { paddingRight: 36 } : undefined}
        >
          <Text variant="bodyStrong" numberOfLines={2}>
            {exercise.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {muscles || exercise.category}
            {exercise.equipment
              ? ` · ${formatEquipmentLabel(exercise.equipment, t)}`
              : ''}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {t(`workout.type.${exercise.exercise_type}`)}
            {exercise.difficulty
              ? ` · ${t(`workout.difficulty.${exercise.difficulty}`)}`
              : ''}
          </Text>
          {estimatedKcal != null && estimatedKcal > 0 ? (
            <Text variant="caption" tone="brand" numberOfLines={1}>
              {estimateActivityLabel
                ? t('workout.cardEstimatedKcalActivity', {
                    value: Math.round(estimatedKcal),
                    minutes: estimateMinutes,
                    activity: estimateActivityLabel,
                  })
                : t('workout.cardEstimatedKcal', {
                    value: Math.round(estimatedKcal),
                    minutes: estimateMinutes,
                  })}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

export const ExerciseListCard = memo(ExerciseListCardComponent);
