import type { ReminderPreferences } from './types';

/** Suggested defaults — editable; not mandatory schedules. */
export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  version: 1,
  workout: {
    enabled: false,
    time: { hour: 18, minute: 0 },
    weekdays: [1, 3, 5], // Mon / Wed / Fri
  },
  meals: {
    breakfast: { enabled: false, time: { hour: 8, minute: 0 } },
    lunch: { enabled: false, time: { hour: 12, minute: 30 } },
    dinner: { enabled: false, time: { hour: 18, minute: 30 } },
  },
  hydration: {
    enabled: false,
    intervalMinutes: 120,
    windowStart: { hour: 9, minute: 0 },
    windowEnd: { hour: 21, minute: 0 },
  },
};

/** Hard cap so hydration cannot flood the notification tray. */
export const MAX_HYDRATION_REMINDERS_PER_DAY = 12;

export const HYDRATION_INTERVAL_OPTIONS_MINUTES = [60, 90, 120, 180, 240] as const;
