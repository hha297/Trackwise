import { addDays, subDays } from 'date-fns';

import { parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

/** Inclusive local calendar day keys from startKey → endKey (yyyy-MM-dd). */
export function diaryDayKeysInclusive(startKey: string, endKey: string): string[] {
  if (startKey > endKey) return [];
  const keys: string[] = [];
  let cursor = parseDiaryDateKey(startKey);
  const end = parseDiaryDateKey(endKey);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDiaryDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

export function shiftDiaryDateKey(dateKey: string, deltaDays: number): string {
  return toDiaryDateKey(addDays(parseDiaryDateKey(dateKey), deltaDays));
}

export function previousDiaryDateKey(dateKey: string): string {
  return toDiaryDateKey(subDays(parseDiaryDateKey(dateKey), 1));
}

/**
 * Lookback window for longest-streak calculations.
 * ~13 months keeps queries bounded while covering typical consistency history.
 */
export const STREAK_LOOKBACK_DAYS = 400;

export function streakHistoryRange(todayKey: string): { startKey: string; endKey: string } {
  return {
    startKey: shiftDiaryDateKey(todayKey, -(STREAK_LOOKBACK_DAYS - 1)),
    endKey: todayKey,
  };
}
