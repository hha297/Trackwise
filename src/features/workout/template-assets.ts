import type { ImageSourcePropType } from 'react-native';

import type { WorkoutTemplate } from '@/features/workout/types';

/**
 * Cover art for system workout templates.
 * Never reuse muscle-hub or library-subcategory tiles — those appear elsewhere in the UI.
 */
const TEMPLATE_COVERS: Record<string, ImageSourcePropType> = {
  'full-body': require('../../../assets/images/workout/exercises/strength/templates/full-body.webp'),
  'upper-body': require('../../../assets/images/workout/exercises/strength/templates/upper-body.avif'),
  'lower-body': require('../../../assets/images/workout/exercises/strength/templates/lower-body.jpg'),
  'push-day': require('../../../assets/images/workout/exercises/strength/templates/push-day.jpg'),
  'pull-day': require('../../../assets/images/workout/exercises/strength/templates/pull-day.avif'),
  'leg-day': require('../../../assets/images/workout/exercises/strength/templates/leg-day.webp'),
  'beginner-strength': require('../../../assets/images/workout/exercises/strength/templates/beginner-strength.jpg'),
  hiit: require('../../../assets/images/workout/exercises/cardio/templates/hiit.webp'),
  'core-workout': require('../../../assets/images/workout/exercises/bodyweight/templates/core-workout.jpg'),

  // Muscle-focus templates — exercise stills not used as muscle hub / subcategory covers
  'chest-builder': require('../../../assets/images/workout/exercises/strength/chest/incline-dumbbell-bench-press.webp'),
  'back-builder': require('../../../assets/images/workout/exercises/strength/back/lat-pulldown.webp'),
  'shoulder-pump': require('../../../assets/images/workout/exercises/strength/shoulders/overhead-press.webp'),
  'glute-focus': require('../../../assets/images/workout/exercises/strength/glutes/hip-thrust.webp'),
  'arm-pump': require('../../../assets/images/workout/exercises/strength/biceps/hammer-curl.webp'),

  // Expanded templates — avoid subcategory tiles (easy-jog, box-jump, back-squat, chest-opener, …)
  'power-circuit': require('../../../assets/images/workout/exercises/strength/glutes/kettlebell-swings.webp'),
  'engine-builder': require('../../../assets/images/workout/exercises/cardio/running/interval-run.webp'),
  'jump-conditioner': require('../../../assets/images/workout/exercises/cardio/jumping/depth-jump.webp'),
  'calisthenics-starter': require('../../../assets/images/workout/exercises/bodyweight/calisthenics/pull-up.jpg'),
  'core-crusher': require('../../../assets/images/workout/exercises/bodyweight/core/hanging-leg-raise.jpg'),
  'mobility-flow': require('../../../assets/images/workout/exercises/flexibility/mobility/world-greatest-stretch.webp'),
  'yoga-essentials': require('../../../assets/images/workout/exercises/flexibility/yoga/downward-facing-dog.avif'),
  'desk-reset': require('../../../assets/images/workout/exercises/flexibility/stretching/neck-side-stretch.webp'),

  // Quality-refresh additions — stills not used as muscle/subcategory hub tiles
  'push-hypertrophy': require('../../../assets/images/workout/exercises/strength/chest/dumbbell-bench-press.jpg'),
  'pull-hypertrophy': require('../../../assets/images/workout/exercises/strength/back/seated-cable-row.avif'),
  'posterior-chain': require('../../../assets/images/workout/exercises/strength/back/conventional-deadlift.jpg'),
  'quads-builder': require('../../../assets/images/workout/exercises/strength/glutes/bulgarian-split-squat.jpg'),
  'home-dumbbell': require('../../../assets/images/workout/exercises/strength/shoulders/seated-dumbbell-shoulder-press.jpg'),
  'fat-loss-circuit': require('../../../assets/images/workout/exercises/cardio/hiit/burpees.webp'),
  'advanced-calisthenics': require('../../../assets/images/workout/exercises/bodyweight/arms/dips.webp'),
  'athletic-conditioning': require('../../../assets/images/workout/exercises/cardio/hiit/battle-ropes.webp'),
};

/** Stable name → cover key (1:1). */
const TEMPLATE_COVER_KEYS: Record<string, string> = {
  'Full Body': 'full-body',
  'Upper Body': 'upper-body',
  'Lower Body': 'lower-body',
  'Push Day': 'push-day',
  'Pull Day': 'pull-day',
  'Leg Day': 'leg-day',
  'Beginner Strength': 'beginner-strength',
  HIIT: 'hiit',
  'Core Workout': 'core-workout',
  'Core Crusher': 'core-crusher',
  'Chest Builder': 'chest-builder',
  'Back Builder': 'back-builder',
  'Shoulder Pump': 'shoulder-pump',
  'Glute Focus': 'glute-focus',
  'Arm Pump': 'arm-pump',
  'Power Circuit': 'power-circuit',
  'Engine Builder': 'engine-builder',
  'Jump Conditioner': 'jump-conditioner',
  'Calisthenics Starter': 'calisthenics-starter',
  'Mobility Flow': 'mobility-flow',
  'Yoga Essentials': 'yoga-essentials',
  'Desk Reset': 'desk-reset',
  'Push Hypertrophy': 'push-hypertrophy',
  'Pull Hypertrophy': 'pull-hypertrophy',
  'Posterior Chain': 'posterior-chain',
  'Quads Builder': 'quads-builder',
  'Home Dumbbell': 'home-dumbbell',
  'Fat-Loss Circuit': 'fat-loss-circuit',
  'Advanced Calisthenics': 'advanced-calisthenics',
  'Athletic Conditioning': 'athletic-conditioning',
};

export function getTemplateCover(
  template: Pick<WorkoutTemplate, 'name' | 'category' | 'image_key'>,
): ImageSourcePropType {
  // Name map wins so templates that share a legacy DB image_key still get unique art.
  const fromName = TEMPLATE_COVER_KEYS[template.name];
  if (fromName && TEMPLATE_COVERS[fromName]) {
    return TEMPLATE_COVERS[fromName];
  }
  if (template.image_key && TEMPLATE_COVERS[template.image_key]) {
    return TEMPLATE_COVERS[template.image_key];
  }
  // Never fall back to muscle/category hub art — use a dedicated strength template cover.
  return TEMPLATE_COVERS['full-body']!;
}
