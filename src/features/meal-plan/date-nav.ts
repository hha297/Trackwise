import { addDays } from 'date-fns';

import { weekDateKeys } from '@/features/diary/aggregations';
import { parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve Meal Plan opening date from route param or today (local). */
export function resolveMealPlanDate(param: string | undefined, todayKey = toDiaryDateKey()): string {
  return typeof param === 'string' && DATE_RE.test(param) ? param : todayKey;
}

/** Monday-start week containing selectedDate — for the compact day strip only. */
export function dayStripKeys(selectedDate: string): string[] {
  return weekDateKeys(selectedDate);
}

/** Move one calendar day; strip follows selected date. */
export function shiftDay(selectedDate: string, direction: -1 | 1): string {
  return toDiaryDateKey(addDays(parseDiaryDateKey(selectedDate), direction));
}
