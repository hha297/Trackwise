import { differenceInCalendarDays } from 'date-fns';

import { parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

export function daysBetweenDiaryKeys(earlierKey: string, laterKey: string): number {
  return differenceInCalendarDays(parseDiaryDateKey(laterKey), parseDiaryDateKey(earlierKey));
}

export function maxDiaryDateKey(keys: Iterable<string>): string | null {
  let max: string | null = null;
  for (const key of keys) {
    if (!key) continue;
    if (max == null || key > max) max = key;
  }
  return max;
}

export function minDiaryDateKey(keys: Iterable<string>): string | null {
  let min: string | null = null;
  for (const key of keys) {
    if (!key) continue;
    if (min == null || key < min) min = key;
  }
  return min;
}

/** Local calendar key for an ISO timestamp (workout started_at). */
export function activityDateKeyFromTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return toDiaryDateKey(now);
  return toDiaryDateKey(date);
}
