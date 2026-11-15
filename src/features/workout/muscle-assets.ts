import type { ImageSourcePropType } from 'react-native';

/**
 * Local muscle-group artwork under `assets/images/workout/muscles/`.
 * Keys match Strength subcategory ids in library-taxonomy.
 * Static require() only — filename `shoulder.jpg` maps to id `shoulders`.
 */
export const WORKOUT_MUSCLE_IMAGES: Record<string, ImageSourcePropType> = {
  chest: require('../../../assets/images/workout/muscles/chest.webp'),
  back: require('../../../assets/images/workout/muscles/back.webp'),
  shoulders: require('../../../assets/images/workout/muscles/shoulder.jpg'),
  biceps: require('../../../assets/images/workout/muscles/biceps.jpg'),
  triceps: require('../../../assets/images/workout/muscles/triceps.webp'),
  forearms: require('../../../assets/images/workout/muscles/forearms.jpg'),
  quadriceps: require('../../../assets/images/workout/muscles/quadriceps.webp'),
  hamstrings: require('../../../assets/images/workout/muscles/hamstrings.jpg'),
  glutes: require('../../../assets/images/workout/muscles/glutes.jpg'),
  calves: require('../../../assets/images/workout/muscles/calves.webp'),
  core: require('../../../assets/images/workout/muscles/core.jpg'),
};

export function getMuscleImage(subId: string): ImageSourcePropType | null {
  return WORKOUT_MUSCLE_IMAGES[subId] ?? null;
}
