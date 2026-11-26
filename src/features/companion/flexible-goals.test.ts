import { describe, expect, it } from 'vitest';

import {
  canOfferLighterDay,
  flexibleDayCalories,
  lighterDayCalories,
  resolveEffectiveCalorieTarget,
  validateOverrideCalories,
} from './flexible-goals';
import { OVERRIDE_CALORIE_MAX, OVERRIDE_CALORIE_MIN } from './constants';

describe('resolveEffectiveCalorieTarget', () => {
  it('uses the original target when there is no override', () => {
    const result = resolveEffectiveCalorieTarget({
      original: 2000,
      dateKey: '2026-11-16',
      override: null,
    });
    expect(result).toEqual({
      original: 2000,
      effective: 2000,
      adjusted: false,
      preset: 'usual',
    });
  });

  it('applies an override only on the matching local date', () => {
    const today = resolveEffectiveCalorieTarget({
      original: 2000,
      dateKey: '2026-11-16',
      override: { overrideDate: '2026-11-16', calories: 2200 },
    });
    expect(today?.effective).toBe(2200);
    expect(today?.adjusted).toBe(true);
    const otherDay = resolveEffectiveCalorieTarget({
      original: 2000,
      dateKey: '2026-11-17',
      override: { overrideDate: '2026-11-16', calories: 2200 },
    });
    expect(otherDay?.effective).toBe(2000);
    expect(otherDay?.adjusted).toBe(false);
  });

  it('does not treat a restored (deleted) override as still active', () => {
    const result = resolveEffectiveCalorieTarget({
      original: 2000,
      dateKey: '2026-11-16',
      override: null,
    });
    expect(result?.preset).toBe('usual');
  });
});

describe('validateOverrideCalories', () => {
  it('rejects missing original, non-integers, negatives, and extremes', () => {
    expect(validateOverrideCalories({ original: null, raw: 1800 }).ok).toBe(false);
    expect(validateOverrideCalories({ original: 2000, raw: '12.5' })).toMatchObject({
      reason: 'not_integer',
    });
    expect(validateOverrideCalories({ original: 2000, raw: -100 })).toMatchObject({
      reason: 'too_low',
    });
    expect(validateOverrideCalories({ original: 2000, raw: OVERRIDE_CALORIE_MIN - 1 })).toMatchObject({
      reason: 'too_low',
    });
    expect(validateOverrideCalories({ original: 2000, raw: OVERRIDE_CALORIE_MAX + 1 })).toMatchObject({
      reason: 'too_high',
    });
    expect(validateOverrideCalories({ original: 2000, raw: 2000 })).toMatchObject({
      reason: 'unchanged',
    });
  });

  it('accepts a modest same-day adjustment', () => {
    expect(validateOverrideCalories({ original: 2000, raw: 2200 })).toEqual({
      ok: true,
      calories: 2200,
    });
  });
});

describe('presets', () => {
  it('never drops a lighter day below the safety floor', () => {
    expect(lighterDayCalories(1220)).toBeGreaterThanOrEqual(OVERRIDE_CALORIE_MIN);
    expect(canOfferLighterDay(1200)).toBe(false);
  });

  it('raises a busy day only modestly', () => {
    expect(flexibleDayCalories(2000)).toBe(2200);
  });
});
