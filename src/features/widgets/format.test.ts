import { describe, expect, it } from 'vitest';

import { clamp01, formatConsumedTarget, formatPercentDetail, progressAgainstTarget } from './format';

describe('widget progress helpers', () => {
  it('clamps missing and overflow progress', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(progressAgainstTarget(50, 100)).toBe(0.5);
    expect(progressAgainstTarget(10, 0)).toBe(0);
  });

  it('formats a percent bullet line from existing progress', () => {
    expect(formatPercentDetail(0.74, '56 g')).toBe('74% \u2022 56 g');
    expect(formatPercentDetail(1, '123 g')).toBe('100% \u2022 123 g');
  });

  it('formats consumed over target without changing the numbers', () => {
    expect(formatConsumedTarget(0, 130, 'g', 'en')).toBe('0/130 g');
    expect(formatConsumedTarget(20, 130, 'g', 'en')).toBe('20/130 g');
  });
});
