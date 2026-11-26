import { describe, expect, it } from 'vitest';

import {
  clamp01,
  displayRemainingMagnitude,
  formatCompactNumber,
  formatConsumedTarget,
  formatPercentDetail,
  formatPercentLabel,
  isTargetExceeded,
  progressAgainstTarget,
  remainingTowardTarget,
} from './format';

describe('widget progress helpers', () => {
  it('clamps missing, overflow, and invalid progress', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });

  it('computes progress against a target without inventing values', () => {
    expect(progressAgainstTarget(0, 100)).toBe(0);
    expect(progressAgainstTarget(50, 100)).toBe(0.5);
    expect(progressAgainstTarget(100, 100)).toBe(1);
    expect(progressAgainstTarget(180, 100)).toBe(1);
    expect(progressAgainstTarget(10, 0)).toBe(0);
    expect(progressAgainstTarget(10, -20)).toBe(0);
    expect(progressAgainstTarget(Number.NaN, 100)).toBe(0);
    expect(progressAgainstTarget(50, Number.NaN)).toBe(0);
  });

  it('keeps remaining magnitude non-negative and null without a target', () => {
    expect(remainingTowardTarget(20, 130)).toBe(110);
    expect(remainingTowardTarget(180, 130)).toBe(-50);
    expect(displayRemainingMagnitude(20, 130)).toBe(110);
    expect(displayRemainingMagnitude(180, 130)).toBe(50);
    expect(displayRemainingMagnitude(20, 0)).toBeNull();
    expect(displayRemainingMagnitude(Number.NaN, 100)).toBeNull();
    expect(isTargetExceeded(180, 130)).toBe(true);
    expect(isTargetExceeded(20, 130)).toBe(false);
    expect(isTargetExceeded(20, 0)).toBe(false);
  });

  it('formats a percent bullet line from existing progress', () => {
    expect(formatPercentDetail(0.74, '56 g')).toBe('74% \u2022 56 g');
    expect(formatPercentDetail(1, '123 g')).toBe('100% \u2022 123 g');
    expect(formatPercentLabel(0.25, 'en')).toBe('25%');
    expect(formatPercentLabel(1.4, 'en')).toBe('100%');
  });

  it('formats consumed over target without changing the numbers', () => {
    expect(formatConsumedTarget(0, 130, 'g', 'en')).toBe('0 / 130 g');
    expect(formatConsumedTarget(20, 130, 'g', 'en')).toBe('20 / 130 g');
    expect(formatConsumedTarget(2150, 2800, 'kcal', 'en')).toBe('2,150 / 2,800 kcal');
    expect(formatConsumedTarget(12.6, 40.2, 'g', 'en')).toBe('13 / 40 g');
    expect(formatConsumedTarget(1_234_567, 2_000_000, 'g', 'en')).toBe('1,234,567 / 2,000,000 g');
    expect(formatCompactNumber(Number.NaN, 'en')).toBe('—');
    expect(formatCompactNumber(Number.POSITIVE_INFINITY, 'en')).toBe('—');
  });
});
