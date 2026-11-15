import { describe, expect, it } from 'vitest';

import {
  parseFoodPickerIntent,
  parseFoodPickerSource,
  parseMealType,
} from './picker-intent';

describe('parseFoodPickerIntent', () => {
  it('defaults to log', () => {
    expect(parseFoodPickerIntent(undefined)).toBe('log');
    expect(parseFoodPickerIntent('other')).toBe('log');
  });

  it('accepts plan', () => {
    expect(parseFoodPickerIntent('plan')).toBe('plan');
  });
});

describe('parseFoodPickerSource', () => {
  it('maps modes to sources', () => {
    expect(parseFoodPickerSource(undefined)).toBe('foods');
    expect(parseFoodPickerSource('manual')).toBe('create');
    expect(parseFoodPickerSource('recipes')).toBe('recipes');
    expect(parseFoodPickerSource('create')).toBe('create');
  });
});

describe('parseMealType', () => {
  it('falls back to lunch', () => {
    expect(parseMealType(undefined)).toBe('lunch');
    expect(parseMealType('brunch')).toBe('lunch');
    expect(parseMealType('dinner')).toBe('dinner');
  });
});
