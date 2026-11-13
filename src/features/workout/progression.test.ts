import { describe, expect, it } from 'vitest';

import { aggregateExerciseSessions, filterSessions, suggestProgression } from './progression';
import type { RecordedSet } from './personal-records';

function row(
  sessionId: string,
  dateKey: string,
  weightKg: number | null,
  reps: number,
): RecordedSet & { dateKey: string } {
  return {
    exerciseKey: 'bench',
    exerciseName: 'Bench Press',
    exerciseType: 'strength',
    weightKg,
    reps,
    completed: true,
    sessionId,
    dateKey,
  };
}

describe('progression', () => {
  it('suggests a small load increase after two solid sessions', () => {
    const points = aggregateExerciseSessions([
      row('a', '2026-11-01', 60, 8),
      row('b', '2026-11-08', 60, 10),
    ]);
    expect(suggestProgression(points, 'strength')).toEqual({ kind: 'add_weight', amountKg: 2.5 });
  });

  it('holds when the latest session dropped reps', () => {
    const points = aggregateExerciseSessions([
      row('a', '2026-11-01', 60, 10),
      row('b', '2026-11-08', 60, 6),
    ]);
    expect(suggestProgression(points, 'strength')).toEqual({ kind: 'none', reason: 'hold' });
  });

  it('does not suggest from a single session', () => {
    const points = aggregateExerciseSessions([row('a', '2026-11-01', 60, 10)]);
    expect(suggestProgression(points, 'strength')).toEqual({ kind: 'none', reason: 'insufficient' });
  });

  it('suggests one more rep for bodyweight work', () => {
    const points = aggregateExerciseSessions([
      row('a', '2026-11-01', null, 8),
      row('b', '2026-11-08', null, 10),
    ]);
    expect(suggestProgression(points, 'bodyweight')).toEqual({ kind: 'add_reps', amount: 1 });
  });

  it('keeps the most recent sessions when filtering', () => {
    const points = aggregateExerciseSessions([
      row('a', '2026-10-01', 40, 8),
      row('b', '2026-10-08', 40, 8),
      row('c', '2026-10-15', 42.5, 8),
      row('d', '2026-10-22', 42.5, 8),
      row('e', '2026-10-29', 45, 8),
    ]);
    expect(filterSessions(points, '4').map((point) => point.sessionId)).toEqual(['b', 'c', 'd', 'e']);
  });
});
