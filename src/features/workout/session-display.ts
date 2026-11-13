import { format, parseISO } from 'date-fns';

/** Update payload for a finished session. Only the name column is included. */
export function workoutNamePatch(name: string): { name: string } {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('NAME_REQUIRED');
  return { name: trimmed };
}

/** Blank input keeps the localized fallback. Stored names are trimmed only. */
export function resolveWorkoutName(input: string | null | undefined, fallback: string): string {
  const trimmed = input?.trim() ?? '';
  return trimmed || fallback;
}

/** Session day shown with the workout name. Calendar date, not a relative phrase. */
export function formatWorkoutDay(iso: string): string {
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'dd/MM/yyyy');
}
