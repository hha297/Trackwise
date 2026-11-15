import { describe, expect, it } from 'vitest';

import { dayStripKeys, resolveMealPlanDate, shiftDay } from './date-nav';

describe('resolveMealPlanDate', () => {
  it('accepts valid YYYY-MM-DD', () => {
    expect(resolveMealPlanDate('2026-11-14', '2026-11-01')).toBe('2026-11-14');
  });

  it('falls back to today for missing or invalid', () => {
    expect(resolveMealPlanDate(undefined, '2026-11-14')).toBe('2026-11-14');
    expect(resolveMealPlanDate('nope', '2026-11-14')).toBe('2026-11-14');
  });
});

describe('dayStripKeys', () => {
  it('returns Monday-start week for the selected day', () => {
    expect(dayStripKeys('2026-11-11')[0]).toBe('2026-11-09');
    expect(dayStripKeys('2026-11-11')).toHaveLength(7);
  });
});

describe('shiftDay', () => {
  it('moves one day and crosses month/year', () => {
    expect(shiftDay('2026-11-14', -1)).toBe('2026-11-13');
    expect(shiftDay('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
});
