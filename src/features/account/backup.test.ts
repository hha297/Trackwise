import { describe, expect, it } from 'vitest';

import { parseTrackwiseBackupJson, validateTrackwiseBackup } from './backup';

const validBackup = {
  format: 'trackwise-backup',
  version: 1,
  exportedAt: '2026-11-02T12:00:00.000Z',
  appVersion: '1.0.0',
  data: {
    profile: { id: 'u1', display_name: 'Alex', units: 'metric' },
    goals: [{ id: 'g1', daily_calorie_target: 2000 }],
    body_measurements: [],
    food_entries: [],
    foods: [],
    food_favorites: [],
    workouts: [],
    workout_exercises: [],
    workout_sets: [],
    workout_templates: [],
    workout_template_variations: [],
    workout_template_exercises: [],
    custom_exercises: [],
    exercise_favorites: [],
    onboarding_progress: null,
  },
};

describe('validateTrackwiseBackup', () => {
  it('accepts a v1 trackwise-backup payload', () => {
    const result = validateTrackwiseBackup(validBackup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.goals).toBe(1);
      expect(result.summary.hasProfile).toBe(true);
    }
  });

  it('accepts legacy calio-backup format', () => {
    const result = validateTrackwiseBackup({ ...validBackup, format: 'calio-backup' });
    expect(result.ok).toBe(true);
  });

  it('rejects wrong format or version', () => {
    expect(validateTrackwiseBackup({ ...validBackup, format: 'other' }).ok).toBe(false);
    expect(validateTrackwiseBackup({ ...validBackup, version: 2 }).ok).toBe(false);
  });

  it('parses JSON text', () => {
    const result = parseTrackwiseBackupJson(JSON.stringify(validBackup));
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const result = parseTrackwiseBackupJson('{nope');
    expect(result.ok).toBe(false);
  });

  it('defaults missing daily nutrition overrides so older backups still import', () => {
    const result = validateTrackwiseBackup(validBackup);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.dailyNutritionOverrides).toBe(0);
    }
  });
});
