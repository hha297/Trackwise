import { describe, expect, it } from 'vitest';

import {
  detectNewPersonalRecords,
  estimatedOneRepMaxKg,
  recordsFromSets,
  type RecordedSet,
} from './personal-records';

function set(partial: Partial<RecordedSet> & Pick<RecordedSet, 'sessionId'>): RecordedSet {
  return {
    exerciseKey: 'squat',
    exerciseName: 'Back Squat',
    exerciseType: 'strength',
    weightKg: 100,
    reps: 5,
    completed: true,
    ...partial,
  };
}

describe('personal records', () => {
  it('counts a logged set even without a separate done flag, and ignores empty rows', () => {
    const records = recordsFromSets([
      set({ sessionId: 'a', completed: false, weightKg: 200, reps: 1 }),
      set({ sessionId: 'a', weightKg: 0, reps: 10 }),
      set({ sessionId: 'a', weightKg: 80, reps: null }),
      set({ sessionId: 'a', weightKg: 80, reps: 5 }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]?.bestWeightKg).toBe(200);
    expect(records[0]?.bestReps).toBe(10);
  });

  it('estimates 1RM only for 1–12 reps', () => {
    expect(estimatedOneRepMaxKg(100, 1)).toBe(100);
    expect(estimatedOneRepMaxKg(100, 5)).toBe(116.7);
    expect(estimatedOneRepMaxKg(100, 13)).toBeNull();
    expect(estimatedOneRepMaxKg(0, 5)).toBeNull();
  });

  it('detects a new weight PR against earlier sessions only', () => {
    const history = [set({ sessionId: 'old', weightKg: 100, reps: 5 })];
    const session = [set({ sessionId: 'now', weightKg: 102.5, reps: 5 })];
    const found = detectNewPersonalRecords(history, session);
    expect(found.some((row) => row.kind === 'weight' && row.previous === 100)).toBe(true);
  });

  it('does not call a repeated load a new PR', () => {
    const history = [set({ sessionId: 'old', weightKg: 100, reps: 5 })];
    const session = [set({ sessionId: 'now', weightKg: 100, reps: 5 })];
    expect(detectNewPersonalRecords(history, session)).toEqual([]);
  });

  it('uses the best session volume, not a single set', () => {
    const records = recordsFromSets([
      set({ sessionId: 'a', weightKg: 100, reps: 5 }),
      set({ sessionId: 'a', weightKg: 100, reps: 5 }),
      set({ sessionId: 'b', weightKg: 90, reps: 8 }),
    ]);
    expect(records[0]?.bestSessionVolumeKg).toBe(1000);
  });
});
