import { describe, expect, it } from 'vitest';

import { matchContextualTips, nutritionDaysOnTrack } from './tips';
import type { TipInput } from './tips';

const TODAY = '2026-11-16';

function input(overrides: Partial<TipInput> = {}): TipInput {
  return {
    todayKey: TODAY,
    proteinTargetG: 150,
    calorieTarget: 2000,
    recentProteinDays: [],
    nutritionKeys: [],
    workoutKeys: [],
    unionKeys: [],
    overdueInWeek: [],
    tipsShown: {},
    ...overrides,
  };
}

describe('matchContextualTips', () => {
  it('returns nothing when no rule matches', () => {
    expect(matchContextualTips(input())).toEqual([]);
  });

  it('matches a low-protein trend across three completed days', () => {
    const matched = matchContextualTips(
      input({
        recentProteinDays: [
          { dateKey: '2026-11-13', proteinG: 80, calories: 1800 },
          { dateKey: '2026-11-14', proteinG: 90, calories: 1800 },
          { dateKey: '2026-11-15', proteinG: 70, calories: 1800 },
        ],
      }),
    );
    expect(matched[0]?.id).toBe('protein_trend_low');
    expect(matched[0]?.cta.href).toBe('/food/add');
  });

  it('does not match protein trend with only two days', () => {
    const matched = matchContextualTips(
      input({
        recentProteinDays: [
          { dateKey: '2026-11-14', proteinG: 80, calories: 1800 },
          { dateKey: '2026-11-15', proteinG: 80, calories: 1800 },
        ],
      }),
    );
    expect(matched.some((row) => row.id === 'protein_trend_low')).toBe(false);
  });

  it('matches missed sessions when two planned workouts are overdue', () => {
    const matched = matchContextualTips(
      input({
        overdueInWeek: [
          { planDate: '2026-11-14', title: 'A' },
          { planDate: '2026-11-15', title: 'B' },
        ],
      }),
    );
    expect(matched[0]?.id).toBe('missed_sessions');
  });

  it('selects the higher-priority tip when several match', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
    const matched = matchContextualTips(
      input({
        recentProteinDays: [
          { dateKey: '2026-11-13', proteinG: 40, calories: 1800 },
          { dateKey: '2026-11-14', proteinG: 40, calories: 1800 },
          { dateKey: '2026-11-15', proteinG: 40, calories: 1800 },
        ],
        unionKeys: days,
        nutritionKeys: days,
      }),
    );
    expect(matched[0]?.id).toBe('protein_trend_low');
  });

  it('respects cooldown after a tip was shown', () => {
    const matched = matchContextualTips(
      input({
        recentProteinDays: [
          { dateKey: '2026-11-13', proteinG: 40, calories: 1800 },
          { dateKey: '2026-11-14', proteinG: 40, calories: 1800 },
          { dateKey: '2026-11-15', proteinG: 40, calories: 1800 },
        ],
        tipsShown: { protein_trend_low: '2026-11-14' },
      }),
    );
    expect(matched.some((row) => row.id === 'protein_trend_low')).toBe(false);
  });

  it('does not show restart and habit tips together', () => {
    const matched = matchContextualTips(
      input({
        unionKeys: ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', TODAY],
      }),
    );
    const ids = matched.map((row) => row.id);
    expect(ids.includes('habit_streak') && ids.includes('restart_simple')).toBe(false);
  });

  it('is deterministic for the same input', () => {
    const payload = input({
      nutritionKeys: ['2026-11-10'],
      unionKeys: ['2026-11-10'],
    });
    expect(matchContextualTips(payload)).toEqual(matchContextualTips(payload));
  });
});

describe('nutritionDaysOnTrack', () => {
  it('ignores today and days without food', () => {
    const days = nutritionDaysOnTrack({
      todayKey: TODAY,
      target: 2000,
      days: [
        { dateKey: '2026-11-15', calories: 2000, hasFood: true },
        { dateKey: TODAY, calories: 2000, hasFood: true },
        { dateKey: '2026-11-14', calories: 2000, hasFood: false },
      ],
    });
    expect(days).toEqual(['2026-11-15']);
  });
});
