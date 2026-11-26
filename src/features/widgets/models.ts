export const DAILY_WIDGET_NAME = 'TrackwiseDaily';
export const WORKOUT_WIDGET_NAME = 'TrackwiseWorkout';

export const DAILY_WIDGET_OPEN_URL = 'trackwise:///';
export const WORKOUT_WIDGET_OPEN_URL = 'trackwise:///workout/plan';

export type WidgetColorScheme = 'light' | 'dark';

export function resolveWidgetColorScheme(value?: string | null): WidgetColorScheme {
  return value === 'dark' ? 'dark' : 'light';
}

/** JSON-serializable props for the Daily home-screen widget. */
export type DailyWidgetProps = {
  signedIn: boolean;
  colorScheme: WidgetColorScheme;
  title: string;
  caloriesLabel: string;
  caloriesValue: string;
  caloriesRatio: string;
  caloriesPercent: string;
  remainingLabel: string;
  remainingValue: string;
  caloriesRemainingLine: string;
  caloriesProgress: number;
  proteinLabel: string;
  proteinValue: string;
  proteinDetail: string;
  proteinRatio: string;
  proteinRemainingLine: string;
  proteinProgress: number;
  carbsLabel: string;
  carbsValue: string;
  carbsDetail: string;
  carbsRatio: string;
  carbsRemainingLine: string;
  carbsProgress: number;
  fatLabel: string;
  fatValue: string;
  fatDetail: string;
  fatRatio: string;
  fatRemainingLine: string;
  fatProgress: number;
  waterLabel: string;
  waterValue: string;
  waterRemainingLine: string;
  waterProgress: number;
  streakLabel: string;
  streakValue: string;
  showStreak: boolean;
  hint: string;
  openUrl: string;
};

/** JSON-serializable props for the Workout home-screen widget. */
export type WorkoutWidgetProps = {
  signedIn: boolean;
  colorScheme: WidgetColorScheme;
  title: string;
  headline: string;
  statusLabel: string;
  detail: string;
  hasSession: boolean;
  completed: boolean;
  hint: string;
  openUrl: string;
};

export const UNSIGNED_DAILY_WIDGET_PROPS: DailyWidgetProps = {
  signedIn: false,
  colorScheme: 'light',
  title: 'Trackwise',
  caloriesLabel: 'Calories',
  caloriesValue: '—',
  caloriesRatio: '—',
  caloriesPercent: '',
  remainingLabel: 'Left',
  remainingValue: '—',
  caloriesRemainingLine: '',
  caloriesProgress: 0,
  proteinLabel: 'Protein',
  proteinValue: '—',
  proteinDetail: '—',
  proteinRatio: '—',
  proteinRemainingLine: '',
  proteinProgress: 0,
  carbsLabel: 'Carbs',
  carbsValue: '—',
  carbsDetail: '—',
  carbsRatio: '—',
  carbsRemainingLine: '',
  carbsProgress: 0,
  fatLabel: 'Fat',
  fatValue: '—',
  fatDetail: '—',
  fatRatio: '—',
  fatRemainingLine: '',
  fatProgress: 0,
  waterLabel: 'Water',
  waterValue: '—',
  waterRemainingLine: '',
  waterProgress: 0,
  streakLabel: 'Streak',
  streakValue: '',
  showStreak: false,
  hint: 'Sign in to see today',
  openUrl: DAILY_WIDGET_OPEN_URL,
};

export const UNSIGNED_WORKOUT_WIDGET_PROPS: WorkoutWidgetProps = {
  signedIn: false,
  colorScheme: 'light',
  title: 'Workout',
  headline: 'Trackwise',
  statusLabel: '',
  detail: '',
  hasSession: false,
  completed: false,
  hint: 'Sign in to see today',
  openUrl: WORKOUT_WIDGET_OPEN_URL,
};
