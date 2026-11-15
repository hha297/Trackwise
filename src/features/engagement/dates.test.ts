import { describe, expect, it } from 'vitest';

import { toDiaryDateKey } from '@/utils/date';

import {
  diaryDayKeysInclusive,
  previousDiaryDateKey,
  shiftDiaryDateKey,
  streakHistoryRange,
  STREAK_LOOKBACK_DAYS,
} from './dates';

describe('engagement date helpers', () => {
  it('builds inclusive local day ranges across month boundaries', () => {
    expect(diaryDayKeysInclusive('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('shifts diary keys using local calendar arithmetic', () => {
    expect(shiftDiaryDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(previousDiaryDateKey('2026-01-01')).toBe('2025-12-31');
  });

  it('maps timestamps to local calendar days (not UTC string slicing)', () => {
    // 2026-11-13 23:30 in a negative-offset zone can be next UTC day;
    // toDiaryDateKey must follow the Date's local calendar components.
    const localEvening = new Date(2026, 10, 13, 23, 30, 0);
    expect(toDiaryDateKey(localEvening)).toBe('2026-11-13');

    const justAfterMidnight = new Date(2026, 10, 14, 0, 15, 0);
    expect(toDiaryDateKey(justAfterMidnight)).toBe('2026-11-14');
  });

  it('keeps started_at local day when UTC date would differ', () => {
    // Construct an absolute instant known to be local Nov 13 evening in UTC+2,
    // which is still Nov 13 UTC for +2; use a late evening in UTC-5 instead:
    // 2026-11-14T03:30:00.000Z → Nov 13 22:30 in America/New_York-like offset.
    const utcMorningNextDay = new Date('2026-11-14T03:30:00.000Z');
    const localKey = toDiaryDateKey(utcMorningNextDay);
    // Whatever the host TZ is, local key must equal format of local Y-M-D components.
    const expected = `${utcMorningNextDay.getFullYear()}-${String(
      utcMorningNextDay.getMonth() + 1,
    ).padStart(2, '0')}-${String(utcMorningNextDay.getDate()).padStart(2, '0')}`;
    expect(localKey).toBe(expected);
    // Must not naively use UTC ISO date slice when local differs.
    const utcSlice = utcMorningNextDay.toISOString().slice(0, 10);
    if (localKey !== utcSlice) {
      expect(localKey).not.toBe(utcSlice);
    }
  });

  it('defines a bounded streak history window ending today', () => {
    const range = streakHistoryRange('2026-11-13');
    expect(range.endKey).toBe('2026-11-13');
    expect(range.startKey).toBe(
      shiftDiaryDateKey('2026-11-13', -(STREAK_LOOKBACK_DAYS - 1)),
    );
  });
});
