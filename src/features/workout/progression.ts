import {
  estimatedOneRepMaxKg,
  isCompletedRepSet,
  isCompletedWeightedSet,
  type RecordedSet,
} from '@/features/workout/personal-records';

export type SessionPoint = {
  sessionId: string;
  dateKey: string;
  maxWeightKg: number | null;
  maxReps: number | null;
  volumeKg: number;
  bestE1rmKg: number | null;
};

export type ProgressionSuggestion =
  | { kind: 'none'; reason: 'insufficient' | 'hold' | 'not_applicable' }
  | { kind: 'add_weight'; amountKg: number }
  | { kind: 'add_reps'; amount: number };

export function aggregateExerciseSessions(
  sets: (RecordedSet & { dateKey: string })[],
): SessionPoint[] {
  const bySession = new Map<string, (RecordedSet & { dateKey: string })[]>();
  for (const set of sets) {
    const list = bySession.get(set.sessionId) ?? [];
    list.push(set);
    bySession.set(set.sessionId, list);
  }

  const points: SessionPoint[] = [];
  for (const [sessionId, rows] of bySession) {
    const reps = rows.filter(isCompletedRepSet);
    if (!reps.length) continue;
    const weighted = rows.filter(isCompletedWeightedSet);
    let bestE1rm: number | null = null;
    let volume = 0;
    for (const set of weighted) {
      if (set.weightKg == null || set.reps == null) continue;
      volume += set.weightKg * set.reps;
      const estimate = estimatedOneRepMaxKg(set.weightKg, set.reps);
      if (estimate != null) bestE1rm = bestE1rm == null ? estimate : Math.max(bestE1rm, estimate);
    }
    points.push({
      sessionId,
      dateKey: rows[0]?.dateKey ?? '',
      maxWeightKg: weighted.length ? Math.max(...weighted.map((set) => set.weightKg ?? 0)) : null,
      maxReps: Math.max(...reps.map((set) => set.reps ?? 0)),
      volumeKg: Math.round(volume * 10) / 10,
      bestE1rmKg: bestE1rm,
    });
  }

  return points.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.sessionId.localeCompare(b.sessionId));
}

export function filterSessions(points: SessionPoint[], range: '4' | '12' | 'all'): SessionPoint[] {
  if (range === 'all') return points;
  const count = range === '4' ? 4 : 12;
  return points.slice(-count);
}

/**
 * Optional suggestion from the last two comparable sessions.
 * Does not change any plan. Skips when history is too thin or the last session slipped.
 */
export function suggestProgression(
  points: SessionPoint[],
  exerciseType: string,
): ProgressionSuggestion {
  if (exerciseType === 'cardio' || exerciseType === 'other') {
    return { kind: 'none', reason: 'not_applicable' };
  }
  if (points.length < 2) return { kind: 'none', reason: 'insufficient' };

  const previous = points[points.length - 2]!;
  const latest = points[points.length - 1]!;

  if (exerciseType === 'bodyweight' || latest.maxWeightKg == null) {
    if (latest.maxReps == null || previous.maxReps == null) {
      return { kind: 'none', reason: 'insufficient' };
    }
    if (latest.maxReps < previous.maxReps) return { kind: 'none', reason: 'hold' };
    if (latest.maxReps >= previous.maxReps && latest.maxReps >= 8) {
      return { kind: 'add_reps', amount: 1 };
    }
    return { kind: 'none', reason: 'hold' };
  }

  if (previous.maxWeightKg == null || latest.maxReps == null || previous.maxReps == null) {
    return { kind: 'none', reason: 'insufficient' };
  }
  if (latest.maxWeightKg < previous.maxWeightKg || latest.maxReps < previous.maxReps) {
    return { kind: 'none', reason: 'hold' };
  }
  const sameWeight = Math.abs(latest.maxWeightKg - previous.maxWeightKg) < 0.05;
  if (sameWeight && latest.maxReps >= 8 && latest.maxReps >= previous.maxReps) {
    return { kind: 'add_weight', amountKg: 2.5 };
  }
  return { kind: 'none', reason: 'hold' };
}

export function compareLastSessions(points: SessionPoint[]): {
  weightDeltaKg: number | null;
  repsDelta: number | null;
  volumeDeltaKg: number | null;
} | null {
  if (points.length < 2) return null;
  const previous = points[points.length - 2]!;
  const latest = points[points.length - 1]!;
  return {
    weightDeltaKg:
      latest.maxWeightKg != null && previous.maxWeightKg != null
        ? Math.round((latest.maxWeightKg - previous.maxWeightKg) * 10) / 10
        : null,
    repsDelta:
      latest.maxReps != null && previous.maxReps != null
        ? latest.maxReps - previous.maxReps
        : null,
    volumeDeltaKg: Math.round((latest.volumeKg - previous.volumeKg) * 10) / 10,
  };
}
