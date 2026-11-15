import type { MealReminderKind, ReminderDeepLink } from './types';

export function parseReminderDeepLink(data: unknown): ReminderDeepLink | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.trackwise !== true) return null;

  if (record.kind === 'workout') return { kind: 'workout' };
  if (record.kind === 'hydration') return { kind: 'hydration' };
  if (record.kind === 'meal') {
    const meal = record.meal;
    if (meal === 'breakfast' || meal === 'lunch' || meal === 'dinner') {
      return { kind: 'meal', meal: meal as MealReminderKind };
    }
  }
  return null;
}
