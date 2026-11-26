import { describe, expect, it } from 'vitest';

import {
  completedWorkoutDateKeys,
  lastMeaningfulActivityKey,
  overdueWorkoutPlans,
  summarizeTodayPlan,
} from './activity';

describe('companion activity helpers', () => {
  it('uses completed workouts only, in local diary order', () => {
    const keys = completedWorkoutDateKeys([
      { started_at: '2026-11-16T08:00:00', status: 'completed' },
      { started_at: '2026-11-15T22:00:00', status: 'in_progress' },
      { started_at: '2026-11-14T18:00:00', status: 'completed' },
    ]);
    expect(keys).toEqual(['2026-11-14', '2026-11-16']);
  });

  it('picks the latest meaningful activity across categories', () => {
    expect(
      lastMeaningfulActivityKey({
        nutritionKeys: ['2026-11-01'],
        hydrationKeys: ['2026-11-10'],
        workoutKeys: ['2026-11-08'],
      }),
    ).toBe('2026-11-10');
  });

  it('summarizes today as rest when only a rest plan exists', () => {
    expect(
      summarizeTodayPlan(
        [
          {
            planDate: '2026-11-16',
            kind: 'rest',
            title: 'Rest',
            completedWorkoutId: null,
          },
        ],
        '2026-11-16',
      )?.kind,
    ).toBe('rest');
  });

  it('lists missed planned workouts before today', () => {
    const overdue = overdueWorkoutPlans(
      [
        {
          planDate: '2026-11-14',
          kind: 'workout',
          title: 'A',
          completedWorkoutId: null,
        },
        {
          planDate: '2026-11-16',
          kind: 'workout',
          title: 'Today',
          completedWorkoutId: null,
        },
        {
          planDate: '2026-11-13',
          kind: 'workout',
          title: 'Done',
          completedWorkoutId: 'w1',
        },
      ],
      '2026-11-16',
    );
    expect(overdue.map((row) => row.planDate)).toEqual(['2026-11-14']);
  });
});
