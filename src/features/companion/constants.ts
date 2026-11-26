/**
 * Documented thresholds for Daily Companion, Comeback, Tips, and Flexible Goals.
 * Keep these in one place — do not scatter magic numbers in UI.
 */

/** Consecutive local calendar days without meaningful activity before a welcome-back. */
export const COMEBACK_INACTIVITY_DAYS = 7;

/** Minimum gap before the same contextual tip can appear again. */
export const TIP_COOLDOWN_DAYS = 5;

/** Protein remaining (g) that warrants a protein suggestion. */
export const PROTEIN_REMAINING_MIN_G = 10;

/** Consumed / target at or above this ratio is "close" to the calorie target. */
export const CALORIES_CLOSE_RATIO = 0.85;

/**
 * Absolute floor for a same-day calorie override.
 * Matches the database check. Never used to silently rewrite the stored goal.
 */
export const OVERRIDE_CALORIE_MIN = 1200;

export const OVERRIDE_CALORIE_MAX = 6000;

/** Temporary "lighter day" multiplier — modest, not a crash diet. */
export const LIGHTER_DAY_RATIO = 0.9;

/** Temporary "busy / more flexible" multiplier. Never a compensation binge. */
export const FLEXIBLE_DAY_RATIO = 1.1;

export const COMPANION_STORAGE_PREFIX = 'trackwise.companion.v1.';

export const WORKOUT_COUNT_MILESTONES = [1, 10, 25, 50] as const;
export const FOOD_DAY_MILESTONES = [1, 7, 30] as const;
export const CONSISTENCY_MILESTONES = [7, 28] as const;
export const NUTRITION_ON_TRACK_MILESTONE_DAYS = 7;
export const ENGAGEMENT_SPAN_DAYS = 90;
export const ENGAGEMENT_MIN_ACTIVE_DAYS = 30;
