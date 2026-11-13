import { describe, expect, it } from 'vitest';

import {
  flOzToMl,
  intakeForDate,
  isValidIntakeMl,
  mlToFlOz,
  progressRatio,
  weekIntake,
} from './calculations';

describe('hydration', () => {
  it('sums only the requested local day', () => {
    const entries = [
      { id: '1', loggedOn: '2026-11-12', amountMl: 250 },
      { id: '2', loggedOn: '2026-11-12', amountMl: 500 },
      { id: '3', loggedOn: '2026-11-11', amountMl: 750 },
    ];
    expect(intakeForDate(entries, '2026-11-12')).toBe(750);
    expect(intakeForDate(entries, '2026-11-13')).toBe(0);
  });

  it('rejects incomplete amounts and keeps a weekly series', () => {
    expect(isValidIntakeMl(0)).toBe(false);
    expect(isValidIntakeMl(250.5)).toBe(false);
    expect(isValidIntakeMl(250)).toBe(true);
    const week = weekIntake(
      [{ id: '1', loggedOn: '2026-11-10', amountMl: 1000 }],
      ['2026-11-09', '2026-11-10'],
    );
    expect(week).toEqual([
      { dateKey: '2026-11-09', amountMl: 0 },
      { dateKey: '2026-11-10', amountMl: 1000 },
    ]);
  });

  it('converts display units without changing the stored millilitres', () => {
    expect(mlToFlOz(500)).toBeCloseTo(16.9, 1);
    expect(flOzToMl(16.9)).toBeGreaterThan(490);
    expect(progressRatio(1250, 2500)).toBe(0.5);
  });
});
