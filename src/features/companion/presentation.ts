import type { CompanionSuggestion, JourneyMilestone, MilestoneId } from './types';

export type CompanionPresentation = {
  id: string;
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  dismissKey: string;
  a11yKey: string;
  href: CompanionSuggestion['cta']['href'];
  params: Record<string, string>;
  interpolation: Record<string, string | number>;
};

const TITLE: Record<string, string> = {
  scheduled_workout: 'companion.card.scheduledWorkout.title',
  overdue_workout: 'companion.card.overdueWorkout.title',
  log_food: 'companion.card.logFood.title',
  protein_remaining: 'companion.card.proteinRemaining.title',
  calories_close: 'companion.card.caloriesClose.title',
  nutrition_complete: 'companion.card.nutritionComplete.title',
  workout_complete: 'companion.card.workoutComplete.title',
  rest_day: 'companion.card.restDay.title',
  optional_activity: 'companion.card.optionalActivity.title',
  multi_progress: 'companion.card.multiProgress.title',
  partial_day: 'companion.card.partialDay.title',
  welcome: 'companion.card.welcome.title',
  protein_trend_low: 'companion.tips.proteinTrendLow.title',
  missed_sessions: 'companion.tips.missedSessions.title',
  logging_gap: 'companion.tips.loggingGap.title',
  restart_simple: 'companion.tips.restartSimple.title',
  habit_streak: 'companion.tips.habitStreak.title',
};

const BODY: Record<string, string> = {
  scheduled_workout: 'companion.card.scheduledWorkout.body',
  overdue_workout: 'companion.card.overdueWorkout.body',
  log_food: 'companion.card.logFood.body',
  protein_remaining: 'companion.card.proteinRemaining.body',
  calories_close: 'companion.card.caloriesClose.body',
  nutrition_complete: 'companion.card.nutritionComplete.body',
  workout_complete: 'companion.card.workoutComplete.body',
  rest_day: 'companion.card.restDay.body',
  optional_activity: 'companion.card.optionalActivity.body',
  multi_progress: 'companion.card.multiProgress.body',
  partial_day: 'companion.card.partialDay.body',
  welcome: 'companion.card.welcome.body',
  protein_trend_low: 'companion.tips.proteinTrendLow.body',
  missed_sessions: 'companion.tips.missedSessions.body',
  logging_gap: 'companion.tips.loggingGap.body',
  restart_simple: 'companion.tips.restartSimple.body',
  habit_streak: 'companion.tips.habitStreak.body',
};

const CTA: Record<string, string> = {
  scheduled_workout: 'companion.card.scheduledWorkout.cta',
  overdue_workout: 'companion.card.overdueWorkout.cta',
  log_food: 'companion.card.logFood.cta',
  protein_remaining: 'companion.card.proteinRemaining.cta',
  calories_close: 'companion.card.caloriesClose.cta',
  nutrition_complete: 'companion.card.nutritionComplete.cta',
  workout_complete: 'companion.card.workoutComplete.cta',
  rest_day: 'companion.card.restDay.cta',
  optional_activity: 'companion.card.optionalActivity.cta',
  multi_progress: 'companion.card.multiProgress.cta',
  partial_day: 'companion.card.partialDay.cta',
  welcome: 'companion.card.welcome.cta',
  protein_trend_low: 'companion.tips.proteinTrendLow.cta',
  missed_sessions: 'companion.tips.missedSessions.cta',
  logging_gap: 'companion.tips.loggingGap.cta',
  restart_simple: 'companion.tips.restartSimple.cta',
  habit_streak: 'companion.tips.habitStreak.cta',
};

export function presentCompanionCard(suggestion: CompanionSuggestion): CompanionPresentation {
  return {
    id: suggestion.id,
    titleKey: TITLE[suggestion.id] ?? 'companion.card.welcome.title',
    bodyKey: BODY[suggestion.id] ?? 'companion.card.welcome.body',
    ctaKey: CTA[suggestion.id] ?? 'companion.card.welcome.cta',
    dismissKey: 'companion.dismiss',
    a11yKey: 'companion.a11y.card',
    href: suggestion.cta.href,
    params: suggestion.cta.params ?? {},
    interpolation: suggestion.params,
  };
}

export const MILESTONE_TITLE_KEY: Record<MilestoneId, string> = {
  first_workout: 'companion.journey.firstWorkout.title',
  workouts_10: 'companion.journey.workouts10.title',
  workouts_25: 'companion.journey.workouts25.title',
  workouts_50: 'companion.journey.workouts50.title',
  first_food_day: 'companion.journey.firstFood.title',
  food_days_7: 'companion.journey.foodDays7.title',
  food_days_30: 'companion.journey.foodDays30.title',
  nutrition_on_track_7: 'companion.journey.nutritionOnTrack7.title',
  consistency_7: 'companion.journey.consistency7.title',
  consistency_28: 'companion.journey.consistency28.title',
  engagement_90: 'companion.journey.engagement90.title',
};

export const MILESTONE_BODY_KEY: Record<MilestoneId, string> = {
  first_workout: 'companion.journey.firstWorkout.body',
  workouts_10: 'companion.journey.workouts10.body',
  workouts_25: 'companion.journey.workouts25.body',
  workouts_50: 'companion.journey.workouts50.body',
  first_food_day: 'companion.journey.firstFood.body',
  food_days_7: 'companion.journey.foodDays7.body',
  food_days_30: 'companion.journey.foodDays30.body',
  nutrition_on_track_7: 'companion.journey.nutritionOnTrack7.body',
  consistency_7: 'companion.journey.consistency7.body',
  consistency_28: 'companion.journey.consistency28.body',
  engagement_90: 'companion.journey.engagement90.body',
};

export function presentMilestone(row: JourneyMilestone): {
  titleKey: string;
  bodyKey: string;
  categoryKey: string;
  achievedOn: string;
  stat: number | null;
} {
  return {
    titleKey: MILESTONE_TITLE_KEY[row.id],
    bodyKey: MILESTONE_BODY_KEY[row.id],
    categoryKey: `companion.journey.category.${row.category}`,
    achievedOn: row.achievedOn,
    stat: row.stat,
  };
}

export const COMPANION_CTA_HREFS: Record<string, CompanionSuggestion['cta']['href']> = {
  scheduled_workout: '/(tabs)/workout',
  overdue_workout: '/workout/plan',
  log_food: '/food/add',
  protein_remaining: '/food/add',
  calories_close: '/(tabs)/progress',
  nutrition_complete: '/(tabs)/progress',
  workout_complete: '/(tabs)/progress',
  rest_day: '/workout/plan',
  optional_activity: '/(tabs)/workout',
  protein_trend_low: '/food/add',
  missed_sessions: '/workout/plan',
  logging_gap: '/food/add',
  restart_simple: '/(tabs)/workout',
  habit_streak: '/(tabs)/progress',
};
