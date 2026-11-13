import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { DEFAULT_REMINDER_PREFERENCES } from './defaults';
import type { ReminderPreferences, TimeOfDay } from './types';

export const REMINDER_PREFS_STORAGE_KEY = 'trackwise.reminderPreferences.v1';

const timeSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

const isoWeekdaySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);

const prefsSchema = z.object({
  version: z.literal(1),
  workout: z.object({
    enabled: z.boolean(),
    time: timeSchema,
    weekdays: z.array(isoWeekdaySchema),
  }),
  meals: z.object({
    breakfast: z.object({ enabled: z.boolean(), time: timeSchema }),
    lunch: z.object({ enabled: z.boolean(), time: timeSchema }),
    dinner: z.object({ enabled: z.boolean(), time: timeSchema }),
  }),
  hydration: z.object({
    enabled: z.boolean(),
    intervalMinutes: z.number().int().min(30).max(12 * 60),
    windowStart: timeSchema,
    windowEnd: timeSchema,
  }),
});

function cloneDefaults(): ReminderPreferences {
  return structuredClone(DEFAULT_REMINDER_PREFERENCES);
}

export function normalizeReminderPreferences(input: unknown): ReminderPreferences {
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return cloneDefaults();

  const data = parsed.data;
  const weekdays = [...new Set(data.workout.weekdays)].sort((a, b) => a - b);
  return {
    version: 1,
    workout: {
      enabled: data.workout.enabled,
      time: data.workout.time,
      weekdays,
    },
    meals: {
      breakfast: data.meals.breakfast,
      lunch: data.meals.lunch,
      dinner: data.meals.dinner,
    },
    hydration: {
      enabled: data.hydration.enabled,
      intervalMinutes: data.hydration.intervalMinutes,
      windowStart: data.hydration.windowStart,
      windowEnd: data.hydration.windowEnd,
    },
  };
}

export async function loadReminderPreferences(): Promise<ReminderPreferences> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_PREFS_STORAGE_KEY);
    if (!raw) return cloneDefaults();
    return normalizeReminderPreferences(JSON.parse(raw) as unknown);
  } catch {
    return cloneDefaults();
  }
}

export async function saveReminderPreferences(
  prefs: ReminderPreferences,
): Promise<ReminderPreferences> {
  const normalized = normalizeReminderPreferences(prefs);
  await AsyncStorage.setItem(REMINDER_PREFS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clampTime(time: TimeOfDay): TimeOfDay {
  return {
    hour: Math.min(23, Math.max(0, Math.trunc(time.hour))),
    minute: Math.min(59, Math.max(0, Math.trunc(time.minute))),
  };
}
