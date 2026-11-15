import { describe, expect, it } from 'vitest';

import {
  buildConsistencySnapshot,
  buildDayActivity,
  buildMilestones,
  buildWeeklyActiveBars,
  consistencyWeeksForPeriod,
  countActiveDaysInMonth,
  countActiveDaysInRange,
  countCategoryActiveDays,
  dayIntensity,
  unionActiveDayKeys,
} from './activity-days';
import { computeLoggingStreak } from './streaks';

describe('unionActiveDayKeys', () => {
  it('dedupes across categories', () => {
    expect(
      unionActiveDayKeys(
        ['2026-11-01', '2026-11-02'],
        ['2026-11-02', '2026-11-03'],
        ['2026-11-03'],
      ),
    ).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });
});

describe('dayIntensity', () => {
  it('counts categories without double-counting same day', () => {
    expect(dayIntensity({ nutrition: true, hydration: true, workout: false })).toBe(2);
    expect(dayIntensity(undefined)).toBe(0);
  });
});

describe('overall consistency uses logging streak rules', () => {
  it('applies grace day and consecutive walk on union keys', () => {
    const nutrition = computeLoggingStreak(['2026-11-11', '2026-11-12'], '2026-11-13');
    const hydration = computeLoggingStreak(['2026-11-12'], '2026-11-13');
    const snap = buildConsistencySnapshot({
      todayKey: '2026-11-13',
      nutritionKeys: ['2026-11-11', '2026-11-12'],
      hydrationKeys: ['2026-11-12'],
      workoutCompletedKeys: [],
      workoutCompletedCurrent: 0,
      workoutLongestCompleted: 0,
      workoutAlive: false,
      nutrition,
      hydration,
    });
    // Today inactive, yesterday active → current 2 (grace)
    expect(snap.overall.current).toBe(2);
    expect(snap.overall.alive).toBe(true);
    expect(snap.nutrition.current).toBe(2);
  });
});

describe('countActiveDaysInMonth', () => {
  it('counts only days in current month up to today', () => {
    const { count, monthKey } = countActiveDaysInMonth(
      ['2026-10-31', '2026-11-01', '2026-11-14', '2026-11-20'],
      '2026-11-14',
    );
    expect(monthKey).toBe('2026-11');
    expect(count).toBe(2);
  });
});

describe('buildWeeklyActiveBars', () => {
  it('returns seven local days ending today', () => {
    const flags = new Map([
      ['2026-11-13', { nutrition: true, hydration: false, workout: false }],
    ]);
    const bars = buildWeeklyActiveBars(flags, '2026-11-14');
    expect(bars).toHaveLength(7);
    expect(bars[0]!.dayKey).toBe('2026-11-08');
    expect(bars[6]!.dayKey).toBe('2026-11-14');
    expect(bars[5]!.anyActive).toBe(true);
  });
});

describe('countCategoryActiveDays', () => {
  it('does not count multiple entries as multiple days', () => {
    expect(
      countCategoryActiveDays(
        ['2026-11-01', '2026-11-01', '2026-11-02'],
        '2026-11-01',
        '2026-11-30',
      ),
    ).toBe(2);
  });
});

describe('countActiveDaysInRange', () => {
  it('counts unique days only inside the inclusive window', () => {
    expect(
      countActiveDaysInRange(
        ['2026-10-31', '2026-11-01', '2026-11-01', '2026-11-15'],
        '2026-11-01',
        '2026-11-14',
      ),
    ).toBe(1);
  });
});

describe('consistencyWeeksForPeriod', () => {
  it('maps Progress periods to heatmap week columns', () => {
    expect(consistencyWeeksForPeriod(7)).toBe(1);
    expect(consistencyWeeksForPeriod(30)).toBe(5);
    expect(consistencyWeeksForPeriod(90)).toBe(13);
  });
});

describe('buildMilestones', () => {
  it('unlocks milestones from best streak', () => {
    const { items, next } = buildMilestones(14);
    expect(items.find((m) => m.days === 7)?.unlocked).toBe(true);
    expect(items.find((m) => m.days === 14)?.unlocked).toBe(true);
    expect(items.find((m) => m.days === 30)?.unlocked).toBe(false);
    expect(next?.days).toBe(30);
  });
});

describe('buildDayActivity', () => {
  it('marks future days', () => {
    const day = buildDayActivity({
      dayKey: '2026-11-15',
      flags: undefined,
      todayKey: '2026-11-14',
    });
    expect(day.isFuture).toBe(true);
    expect(day.anyActive).toBe(false);
  });
});
