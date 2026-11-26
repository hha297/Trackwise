import type { PlanKind } from '@/features/planner/status';

export type CompanionCategory = 'nutrition' | 'workout' | 'general' | 'tip';

export type CompanionCtaHref =
  | '/food/add'
  | '/(tabs)/workout'
  | '/workout/plan'
  | '/goals'
  | '/(tabs)/progress'
  | '/(tabs)';

export type CompanionCta = {
  href: CompanionCtaHref;
  params?: Record<string, string>;
};

export type CompanionSuggestion = {
  id: string;
  category: CompanionCategory;
  /** Lower number wins. Documented in select-companion.ts. */
  priority: number;
  dismissible: boolean;
  params: Record<string, string | number>;
  cta: CompanionCta;
};

export type TodayPlanSummary = {
  kind: PlanKind;
  title: string | null;
  completedWorkoutId: string | null;
};

export type OverduePlanSummary = {
  planDate: string;
  title: string | null;
};

export type CompanionInput = {
  todayKey: string;
  dateKey: string;
  hasGoal: boolean;
  /** Effective calories for today (override or original). */
  calorieTarget: number | null;
  originalCalorieTarget: number | null;
  proteinTargetG: number | null;
  consumedCalories: number;
  consumedProteinG: number;
  hasFoodLogsToday: boolean;
  completedWorkoutsToday: number;
  todayPlan: TodayPlanSummary | null;
  overduePlans: OverduePlanSummary[];
  hasWorkoutHistory: boolean;
  lastMeaningfulActivityKey: string | null;
  dismissedIds: ReadonlySet<string>;
  /** Cooldown-filtered tips, already sorted by their own priority. */
  tips: CompanionSuggestion[];
};

export type ComebackDecision = {
  eligible: boolean;
  reason:
    | 'new_user'
    | 'active'
    | 'below_threshold'
    | 'already_shown'
    | 'eligible';
  lastActivityKey: string | null;
  inactiveDays: number;
};

export type ComebackState = {
  lastActivityAtShow: string;
  shownOn: string;
};

export type CompanionPrefs = {
  version: 1;
  /** Suggestion id → diary date it was dismissed (today-scoped ids include the date). */
  dismissed: Record<string, string>;
  comeback: ComebackState | null;
  /** Tip id → diary date last shown or dismissed. */
  tipsShown: Record<string, string>;
};

export type MilestoneCategory = 'workout' | 'nutrition' | 'consistency';

export type MilestoneId =
  | 'first_workout'
  | 'workouts_10'
  | 'workouts_25'
  | 'workouts_50'
  | 'first_food_day'
  | 'food_days_7'
  | 'food_days_30'
  | 'nutrition_on_track_7'
  | 'consistency_7'
  | 'consistency_28'
  | 'engagement_90';

export type JourneyMilestone = {
  id: MilestoneId;
  category: MilestoneCategory;
  achievedOn: string;
  stat: number | null;
};

export type DailyOverride = {
  overrideDate: string;
  calories: number;
};

export type OverridePreset = 'usual' | 'flexible' | 'lighter' | 'custom';
