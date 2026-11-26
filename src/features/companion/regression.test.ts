import { describe, expect, it } from 'vitest';

import { calculateDailyBalance } from '@/features/diary/balance';
import { classifyDayCalories } from '@/features/diary/goal-status';
import { planStatus, restDayConflict } from '@/features/planner/status';

/**
 * Existing diary, planner, and calorie helpers must keep their contracts.
 * Companion features reuse these; they must not start treating missed days as failure.
 */
describe('companion regression against existing domain helpers', () => {
  it('keeps diary remaining = target - consumed + burned', () => {
    const balance = calculateDailyBalance({ consumed: 500, burned: 200, target: 2000 });
    expect(balance.remaining).toBe(1700);
  });

  it('does not label today as a failed calorie day while it is in progress', () => {
    expect(
      classifyDayCalories({
        consumed: 900,
        target: 2000,
        dateKey: '2026-11-16',
        todayKey: '2026-11-16',
        hasFoodLogs: true,
      }),
    ).toBe('in_progress');
  });

  it('still treats unfinished past workouts as missed, not rest, so they can be rescheduled', () => {
    expect(
      planStatus({
        kind: 'workout',
        planDate: '2026-11-10',
        todayKey: '2026-11-16',
        completedWorkoutId: null,
      }),
    ).toBe('missed');
  });

  it('still allows a planned rest day without wiping workout history', () => {
    expect(
      restDayConflict([{ planDate: '2026-11-16', kind: 'workout' }], {
        planDate: '2026-11-16',
        kind: 'rest',
      }),
    ).toBe(false);
  });
});
