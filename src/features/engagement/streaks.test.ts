import { describe, expect, it } from 'vitest';

import { previousDiaryDateKey, shiftDiaryDateKey } from './dates';
import {
  buildWorkoutDayKinds,
  classifyWorkoutDay,
  computeLoggingStreak,
  computeWorkoutStreak,
} from './streaks';

describe('computeLoggingStreak (nutrition / hydration)', () => {
  it('returns zeros with no records', () => {
    const result = computeLoggingStreak([], '2026-11-13');
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
    expect(result.todayActive).toBe(false);
    expect(result.alive).toBe(false);
  });

  it('counts one active day and collapses multiple entries on that day', () => {
    const result = computeLoggingStreak(
      ['2026-11-13', '2026-11-13', '2026-11-13'],
      '2026-11-13',
    );
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.todayActive).toBe(true);
    expect(result.alive).toBe(true);
  });

  it('builds consecutive current streak including today', () => {
    const result = computeLoggingStreak(
      ['2026-11-11', '2026-11-12', '2026-11-13'],
      '2026-11-13',
    );
    expect(result.current).toBe(3);
    expect(result.currentStartKey).toBe('2026-11-11');
    expect(result.currentEndKey).toBe('2026-11-13');
  });

  it('keeps streak alive when today is inactive but yesterday is active', () => {
    const result = computeLoggingStreak(['2026-11-11', '2026-11-12'], '2026-11-13');
    expect(result.todayActive).toBe(false);
    expect(result.alive).toBe(true);
    expect(result.current).toBe(2);
    expect(result.currentEndKey).toBe('2026-11-12');
  });

  it('zeros current streak when today and yesterday are inactive', () => {
    const result = computeLoggingStreak(['2026-11-10'], '2026-11-13');
    expect(result.current).toBe(0);
    expect(result.alive).toBe(false);
    expect(result.longest).toBe(1);
  });

  it('breaks on a missing day and tracks longest historical run', () => {
    const result = computeLoggingStreak(
      ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'],
      '2026-11-13',
    );
    expect(result.current).toBe(0);
    expect(result.longest).toBe(3);
  });

  it('crosses month and year boundaries', () => {
    const result = computeLoggingStreak(
      ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'],
      '2026-01-02',
    );
    expect(result.current).toBe(4);
    expect(result.longest).toBe(4);
  });
});

describe('workout day classification', () => {
  it('prefers completed workout over rest plan', () => {
    expect(
      classifyWorkoutDay({ hasCompletedWorkout: true, hasPlannedRestOrRecovery: true }),
    ).toBe('active');
  });

  it('marks planned rest/recovery as neutral without a workout', () => {
    expect(
      classifyWorkoutDay({ hasCompletedWorkout: false, hasPlannedRestOrRecovery: true }),
    ).toBe('neutral');
  });
});

describe('computeWorkoutStreak', () => {
  it('counts completed days and ignores discarded-only history (not in map)', () => {
    const kinds = buildWorkoutDayKinds({
      completedWorkoutDayKeys: ['2026-11-11', '2026-11-13'],
      restOrRecoveryDayKeys: ['2026-11-12'],
    });
    const result = computeWorkoutStreak(kinds, '2026-11-13');
    expect(result.currentCompletedDays).toBe(2);
    expect(result.todayKind).toBe('active');
    expect(result.alive).toBe(true);
  });

  it('treats rest and recovery as neutral without increasing completed count', () => {
    const kinds = buildWorkoutDayKinds({
      completedWorkoutDayKeys: ['2026-11-10', '2026-11-12'],
      restOrRecoveryDayKeys: ['2026-11-11', '2026-11-13'],
    });
    const result = computeWorkoutStreak(kinds, '2026-11-13');
    expect(result.todayKind).toBe('neutral');
    expect(result.currentCompletedDays).toBe(2);
    expect(result.alive).toBe(true);
  });

  it('breaks on an unplanned inactive day', () => {
    const kinds = buildWorkoutDayKinds({
      completedWorkoutDayKeys: ['2026-11-10', '2026-11-13'],
      restOrRecoveryDayKeys: [],
    });
    // Gap 11–12 inactive → current from today only
    const result = computeWorkoutStreak(kinds, '2026-11-13');
    expect(result.currentCompletedDays).toBe(1);
    expect(result.longestCompletedDays).toBe(1);
  });

  it('uses yesterday grace when today is unplanned inactive', () => {
    const kinds = buildWorkoutDayKinds({
      completedWorkoutDayKeys: ['2026-11-11', '2026-11-12'],
      restOrRecoveryDayKeys: [],
    });
    const result = computeWorkoutStreak(kinds, '2026-11-13');
    expect(result.todayKind).toBe('inactive');
    expect(result.alive).toBe(true);
    expect(result.currentCompletedDays).toBe(2);
  });

  it('zeros when today and yesterday are unplanned inactive', () => {
    const kinds = buildWorkoutDayKinds({
      completedWorkoutDayKeys: ['2026-11-10'],
      restOrRecoveryDayKeys: [],
    });
    const result = computeWorkoutStreak(kinds, '2026-11-13');
    expect(result.alive).toBe(false);
    expect(result.currentCompletedDays).toBe(0);
    expect(result.longestCompletedDays).toBe(1);
  });

  it('does not treat every empty day as rest', () => {
    const kinds = buildWorkoutDayKinds({
      completedWorkoutDayKeys: ['2026-11-12'],
      restOrRecoveryDayKeys: [],
    });
    expect(kinds.get('2026-11-13') ?? 'inactive').toBe('inactive');
  });

  it('handles rest at the start of a span', () => {
    const kinds = buildWorkoutDayKinds({
      completedWorkoutDayKeys: ['2026-11-12', '2026-11-13'],
      restOrRecoveryDayKeys: ['2026-11-11'],
    });
    const result = computeWorkoutStreak(kinds, '2026-11-13');
    expect(result.currentCompletedDays).toBe(2);
    expect(result.currentStartKey).toBe('2026-11-11');
  });

  it('tracks longest completed days across multiple spans', () => {
    const kinds = buildWorkoutDayKinds({
      completedWorkoutDayKeys: [
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-10',
        '2026-10-11',
      ],
      restOrRecoveryDayKeys: ['2026-10-04'],
    });
    // 01-02-03 active + 04 rest = 3 completed; then gap; then 10-11 = 2
    const result = computeWorkoutStreak(kinds, '2026-11-13');
    expect(result.longestCompletedDays).toBe(3);
    expect(result.currentCompletedDays).toBe(0);
  });
});

describe('local calendar helpers used by streaks', () => {
  it('shifts diary keys without UTC string parsing pitfalls', () => {
    expect(shiftDiaryDateKey('2026-11-13', -1)).toBe('2026-11-12');
    expect(previousDiaryDateKey('2026-03-01')).toBe('2026-02-28');
    expect(shiftDiaryDateKey('2025-12-31', 1)).toBe('2026-01-01');
  });
});
