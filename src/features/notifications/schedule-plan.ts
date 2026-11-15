import { MAX_HYDRATION_REMINDERS_PER_DAY } from './defaults';
import type {
  IsoWeekday,
  MealReminderKind,
  PlannedReminder,
  ReminderPreferences,
  TimeOfDay,
} from './types';
import { REMINDER_ID_PREFIX } from './types';

/** Convert Trackwise ISO weekday (Mon=1…Sun=7) → Expo weekly weekday (Sun=1…Sat=7). */
export function isoWeekdayToExpo(iso: IsoWeekday): number {
  return iso === 7 ? 1 : iso + 1;
}

export function expoWeekdayToIso(expo: number): IsoWeekday {
  if (expo === 1) return 7;
  return (expo - 1) as IsoWeekday;
}

export function minutesOfDay(time: TimeOfDay): number {
  return time.hour * 60 + time.minute;
}

export function timeFromMinutes(total: number): TimeOfDay {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return { hour: Math.floor(normalized / 60), minute: normalized % 60 };
}

export function formatTimeOfDay(time: TimeOfDay): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

export function parseTimeOfDay(value: string): TimeOfDay | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Wall-clock hydration slots from start→end at intervalMinutes (inclusive start).
 * Empty when interval invalid, window empty/inverted, or would exceed the daily cap
 * without clamping — we clamp by stopping at the cap.
 */
export function buildHydrationSlots(
  windowStart: TimeOfDay,
  windowEnd: TimeOfDay,
  intervalMinutes: number,
  maxSlots: number = MAX_HYDRATION_REMINDERS_PER_DAY,
): TimeOfDay[] {
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 30) return [];
  const start = minutesOfDay(windowStart);
  const end = minutesOfDay(windowEnd);
  if (end <= start) return [];

  const slots: TimeOfDay[] = [];
  for (let cursor = start; cursor <= end; cursor += intervalMinutes) {
    slots.push(timeFromMinutes(cursor));
    if (slots.length >= maxSlots) break;
  }
  return slots;
}

export type ReminderCopy = {
  workout: { title: string; body: string };
  meals: Record<MealReminderKind, { title: string; body: string }>;
  hydration: { title: string; body: string };
};

/** Pure plan builder — no native APIs. Disabled categories produce no entries. */
export function buildReminderPlan(
  prefs: ReminderPreferences,
  copy: ReminderCopy,
): PlannedReminder[] {
  const plan: PlannedReminder[] = [];

  if (prefs.workout.enabled && prefs.workout.weekdays.length > 0) {
    const uniqueDays = [...new Set(prefs.workout.weekdays)].sort((a, b) => a - b);
    for (const iso of uniqueDays) {
      const expoWeekday = isoWeekdayToExpo(iso);
      plan.push({
        identifier: `${REMINDER_ID_PREFIX}workout.${expoWeekday}`,
        title: copy.workout.title,
        body: copy.workout.body,
        expoWeekday,
        hour: prefs.workout.time.hour,
        minute: prefs.workout.time.minute,
        data: { trackwise: true, kind: 'workout' },
      });
    }
  }

  (['breakfast', 'lunch', 'dinner'] as const).forEach((meal) => {
    const mealPrefs = prefs.meals[meal];
    if (!mealPrefs.enabled) return;
    plan.push({
      identifier: `${REMINDER_ID_PREFIX}meal.${meal}`,
      title: copy.meals[meal].title,
      body: copy.meals[meal].body,
      expoWeekday: null,
      hour: mealPrefs.time.hour,
      minute: mealPrefs.time.minute,
      data: { trackwise: true, kind: 'meal', meal },
    });
  });

  if (prefs.hydration.enabled) {
    const slots = buildHydrationSlots(
      prefs.hydration.windowStart,
      prefs.hydration.windowEnd,
      prefs.hydration.intervalMinutes,
    );
    for (const slot of slots) {
      const key = formatTimeOfDay(slot).replace(':', '');
      plan.push({
        identifier: `${REMINDER_ID_PREFIX}hydrate.${key}`,
        title: copy.hydration.title,
        body: copy.hydration.body,
        expoWeekday: null,
        hour: slot.hour,
        minute: slot.minute,
        data: { trackwise: true, kind: 'hydration' },
      });
    }
  }

  return plan;
}

export function isTrackwiseReminderId(identifier: string | null | undefined): boolean {
  return Boolean(identifier && identifier.startsWith(REMINDER_ID_PREFIX));
}

/** Idempotent merge: desired plan IDs vs currently scheduled Trackwise IDs. */
export function diffReminderSchedules(
  desired: PlannedReminder[],
  scheduledIds: string[],
): { toCancel: string[]; toSchedule: PlannedReminder[]; unchanged: string[] } {
  const ownedScheduled = scheduledIds.filter(isTrackwiseReminderId);
  const desiredById = new Map(desired.map((item) => [item.identifier, item]));
  const scheduledSet = new Set(ownedScheduled);

  const toCancel = ownedScheduled.filter((id) => !desiredById.has(id));
  const toSchedule = desired.filter((item) => !scheduledSet.has(item.identifier));
  const unchanged = desired
    .filter((item) => scheduledSet.has(item.identifier))
    .map((item) => item.identifier);

  // When an identifier is reused but content/time may have changed, cancel+reschedule.
  // Callers should treat "unchanged" IDs as needing a content refresh when prefs change.
  return { toCancel, toSchedule, unchanged };
}

/**
 * Full replace set: cancel every owned ID, then schedule the entire desired plan.
 * Safer when time/copy changes reuse the same identifier.
 */
export function fullReplaceTargets(
  desired: PlannedReminder[],
  scheduledIds: string[],
): { toCancel: string[]; toSchedule: PlannedReminder[] } {
  return {
    toCancel: scheduledIds.filter(isTrackwiseReminderId),
    toSchedule: desired,
  };
}
