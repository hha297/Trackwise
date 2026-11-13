import { describe, expect, it } from 'vitest';

import { canMarkPlanComplete, planStatus, restDayConflict } from './status';

describe('weekly plan status', () => {
  it('marks an unfinished past workout as missed', () => {
    expect(
      planStatus({
        kind: 'workout',
        planDate: '2026-11-10',
        todayKey: '2026-11-12',
        completedWorkoutId: null,
      }),
    ).toBe('missed');
  });

  it('does not treat a past rest day as missed', () => {
    expect(
      planStatus({
        kind: 'rest',
        planDate: '2026-11-10',
        todayKey: '2026-11-12',
        completedWorkoutId: null,
      }),
    ).toBe('rest');
  });

  it('keeps a linked session completed even on a later day', () => {
    expect(
      planStatus({
        kind: 'workout',
        planDate: '2026-11-10',
        todayKey: '2026-11-12',
        completedWorkoutId: 'workout-1',
      }),
    ).toBe('completed');
  });

  it('rejects a second completion and a second rest day', () => {
    expect(canMarkPlanComplete('workout-1')).toBe(false);
    expect(canMarkPlanComplete(null)).toBe(true);
    expect(
      restDayConflict(
        [{ planDate: '2026-11-12', kind: 'rest' }],
        { planDate: '2026-11-12', kind: 'recovery' },
      ),
    ).toBe(true);
    expect(
      restDayConflict(
        [{ planDate: '2026-11-12', kind: 'workout' }],
        { planDate: '2026-11-12', kind: 'workout' },
      ),
    ).toBe(false);
  });
});
