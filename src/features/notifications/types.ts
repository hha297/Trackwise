/** ISO weekday: 1 = Monday … 7 = Sunday (matches Trackwise weekStartsOn: 1). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type MealReminderKind = 'breakfast' | 'lunch' | 'dinner';

export type TimeOfDay = {
  hour: number;
  minute: number;
};

export type WorkoutReminderPrefs = {
  enabled: boolean;
  time: TimeOfDay;
  /** Empty = no workout reminders scheduled even if enabled. */
  weekdays: IsoWeekday[];
};

export type MealReminderPrefs = {
  enabled: boolean;
  time: TimeOfDay;
};

export type HydrationReminderPrefs = {
  enabled: boolean;
  /** Minutes between reminders within the window. */
  intervalMinutes: number;
  windowStart: TimeOfDay;
  windowEnd: TimeOfDay;
};

export type ReminderPreferences = {
  version: 1;
  workout: WorkoutReminderPrefs;
  meals: Record<MealReminderKind, MealReminderPrefs>;
  hydration: HydrationReminderPrefs;
};

export type ReminderDeepLink =
  | { kind: 'workout' }
  | { kind: 'meal'; meal: MealReminderKind }
  | { kind: 'hydration' };

export type PlannedReminder = {
  /** Stable Trackwise-owned identifier. */
  identifier: string;
  title: string;
  body: string;
  /** Expo weekly weekday 1=Sun … 7=Sat, or null for daily. */
  expoWeekday: number | null;
  hour: number;
  minute: number;
  data: ReminderDeepLink & { trackwise: true };
};

export type PermissionSnapshot = {
  status: 'undetermined' | 'granted' | 'denied' | 'unavailable';
  canAskAgain: boolean;
  /** True when OS allows scheduling/delivery. */
  canNotify: boolean;
};

export const REMINDER_ID_PREFIX = 'trackwise.reminder.';
export const ANDROID_CHANNEL_ID = 'trackwise-reminders';
