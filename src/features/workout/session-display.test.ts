import { describe, expect, it } from 'vitest';

import { formatWorkoutDay, resolveWorkoutName, workoutNamePatch } from './session-display';

describe('workout session display', () => {
  it('keeps a custom name and falls back when the field is empty', () => {
    expect(resolveWorkoutName('  Leg Day  ', 'Workout')).toBe('Leg Day');
    expect(resolveWorkoutName('   ', 'Workout')).toBe('Workout');
    expect(resolveWorkoutName(null, 'Treeni')).toBe('Treeni');
  });

  it('renames a session without touching sets or exercises', () => {
    expect(workoutNamePatch('  Push Day  ')).toEqual({ name: 'Push Day' });
    expect(Object.keys(workoutNamePatch('Chest Day'))).toEqual(['name']);
    expect(() => workoutNamePatch('   ')).toThrow('NAME_REQUIRED');
  });

  it('formats the session day as DD/MM/YYYY', () => {
    expect(formatWorkoutDay('2026-11-12T21:30:00.000Z')).toMatch(/^\d{2}\/11\/2026$/);
    expect(formatWorkoutDay('not-a-date')).toBe('');
  });
});
