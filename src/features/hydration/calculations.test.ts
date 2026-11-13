import { describe, expect, it } from 'vitest';

import {
  flOzToMl,
  intakeForDate,
  isValidIntakeMl,
  mlToFlOz,
  niceCeilMl,
  progressRatio,
  weekChartScaleMax,
  weekChartYTicks,
  weekIntake,
} from './calculations';

describe('hydration', () => {
  it('sums only the requested local day', () => {
    const entries = [
      { id: '1', loggedOn: '2026-11-12', amountMl: 250, createdAt: '2026-11-12T08:00:00.000Z' },
      { id: '2', loggedOn: '2026-11-12', amountMl: 500, createdAt: '2026-11-12T12:00:00.000Z' },
      { id: '3', loggedOn: '2026-11-11', amountMl: 750, createdAt: '2026-11-11T09:00:00.000Z' },
    ];
    expect(intakeForDate(entries, '2026-11-12')).toBe(750);
    expect(intakeForDate(entries, '2026-11-13')).toBe(0);
  });

  it('rejects incomplete amounts and keeps a weekly series', () => {
    expect(isValidIntakeMl(0)).toBe(false);
    expect(isValidIntakeMl(250.5)).toBe(false);
    expect(isValidIntakeMl(250)).toBe(true);
    const week = weekIntake(
      [{ id: '1', loggedOn: '2026-11-10', amountMl: 1000, createdAt: '2026-11-10T10:00:00.000Z' }],
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

  it('keeps the Y scale at least 2L even when intake is lower', () => {
    expect(niceCeilMl(0)).toBe(500);
    expect(niceCeilMl(1800)).toBe(2000);
    expect(weekChartScaleMax([0, 0, 0])).toBe(2000);
    expect(weekChartScaleMax([250, 900, 400])).toBe(2000);
    expect(weekChartScaleMax([250, 3200, 900])).toBe(4000);
    expect(weekChartYTicks(2000)).toEqual([0, 1000, 2000]);
  });
});
