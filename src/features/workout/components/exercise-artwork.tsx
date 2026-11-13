import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  EXERCISE_IMAGE_PLACEHOLDER,
  fallbackExerciseImage,
  resolveExerciseImage,
} from '@/features/workout/catalog/exercise-images';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type ExerciseArtworkProps = {
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageKey?: string | null;
  slug?: string | null;
  name?: string | null;
  size: number;
  recyclingKey: string;
  priority?: 'low' | 'normal' | 'high';
};

export function ExerciseArtwork({
  imageUrl,
  imageStoragePath,
  imageKey,
  slug,
  name,
  size,
  recyclingKey,
  priority = 'low',
}: ExerciseArtworkProps) {
  const colors = useThemeColors();
  return (
    <ExerciseArtworkImage
      key={`${recyclingKey}:${imageUrl ?? ''}`}
      imageUrl={imageUrl}
      imageStoragePath={imageStoragePath}
      imageKey={imageKey}
      slug={slug}
      name={name}
      size={size}
      recyclingKey={recyclingKey}
      priority={priority}
      surfaceColor={colors.surfaceMuted}
    />
  );
}

function ExerciseArtworkImage({
  imageUrl,
  imageStoragePath,
  imageKey,
  slug,
  name,
  size,
  recyclingKey,
  priority,
  surfaceColor,
}: ExerciseArtworkProps & { surfaceColor: string }) {
  const [stage, setStage] = useState<'primary' | 'fallback' | 'placeholder'>('primary');
  const resolved = useMemo(
    () =>
      resolveExerciseImage({
        imageUrl,
        imageStoragePath,
        imageKey,
        slug,
        name,
      }),
    [imageUrl, imageStoragePath, imageKey, slug, name],
  );
  const fallback = useMemo(
    () => fallbackExerciseImage({ imageKey, slug, name }),
    [imageKey, slug, name],
  );
  const source =
    stage === 'placeholder'
      ? EXERCISE_IMAGE_PLACEHOLDER
      : stage === 'fallback'
        ? fallback
        : resolved;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.md,
        overflow: 'hidden',
        backgroundColor: surfaceColor,
      }}
    >
      <Image
        source={source}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        recyclingKey={recyclingKey}
        transition={0}
        cachePolicy="memory-disk"
        priority={priority}
        onError={() =>
          setStage((current) => {
            if (current === 'primary' && fallback !== resolved) return 'fallback';
            return 'placeholder';
          })
        }
      />
    </View>
  );
}
