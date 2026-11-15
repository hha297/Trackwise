export type RecordedSet = {
  exerciseKey: string;
  exerciseName: string;
  exerciseType: string;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  sessionId: string;
};

export type PersonalRecord = {
  exerciseKey: string;
  exerciseName: string;
  bestWeightKg: number | null;
  bestReps: number | null;
  bestE1rmKg: number | null;
  bestSessionVolumeKg: number | null;
};

export type NewPersonalRecord = {
  exerciseKey: string;
  exerciseName: string;
  kind: 'weight' | 'reps' | 'e1rm' | 'volume';
  value: number;
  previous: number | null;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isCompletedRepSet(set: RecordedSet): boolean {
  return set.reps != null && set.reps > 0 && Number.isFinite(set.reps);
}

export function isCompletedWeightedSet(set: RecordedSet): boolean {
  return (
    isCompletedRepSet(set) &&
    set.weightKg != null &&
    set.weightKg > 0 &&
    Number.isFinite(set.weightKg)
  );
}

/** Epley estimate. Only 1–12 completed reps; heavier estimates are too noisy to store as a PR. */
export function estimatedOneRepMaxKg(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps > 0) || !Number.isFinite(weightKg) || !Number.isFinite(reps)) {
    return null;
  }
  if (reps === 1) return round1(weightKg);
  if (reps > 12) return null;
  return round1(weightKg * (1 + reps / 30));
}

function sessionVolume(sets: RecordedSet[]): number {
  return round1(
    sets.reduce((sum, set) => {
      if (!isCompletedWeightedSet(set) || set.weightKg == null || set.reps == null) return sum;
      return sum + set.weightKg * set.reps;
    }, 0),
  );
}

export function recordsFromSets(sets: RecordedSet[]): PersonalRecord[] {
  const byExercise = new Map<string, RecordedSet[]>();
  for (const set of sets) {
    const list = byExercise.get(set.exerciseKey) ?? [];
    list.push(set);
    byExercise.set(set.exerciseKey, list);
  }

  const records: PersonalRecord[] = [];
  for (const [exerciseKey, rows] of byExercise) {
    const validReps = rows.filter(isCompletedRepSet);
    const weighted = rows.filter(isCompletedWeightedSet);
    if (!validReps.length) continue;

    const bySession = new Map<string, RecordedSet[]>();
    for (const row of rows) {
      const list = bySession.get(row.sessionId) ?? [];
      list.push(row);
      bySession.set(row.sessionId, list);
    }
    let bestVolume = 0;
    for (const sessionSets of bySession.values()) {
      bestVolume = Math.max(bestVolume, sessionVolume(sessionSets));
    }

    let bestE1rm: number | null = null;
    for (const set of weighted) {
      if (set.weightKg == null || set.reps == null) continue;
      const estimate = estimatedOneRepMaxKg(set.weightKg, set.reps);
      if (estimate != null) bestE1rm = bestE1rm == null ? estimate : Math.max(bestE1rm, estimate);
    }

    records.push({
      exerciseKey,
      exerciseName: rows[0]?.exerciseName ?? exerciseKey,
      bestWeightKg: weighted.length
        ? round1(Math.max(...weighted.map((set) => set.weightKg ?? 0)))
        : null,
      bestReps: Math.max(...validReps.map((set) => set.reps ?? 0)),
      bestE1rmKg: bestE1rm,
      bestSessionVolumeKg: bestVolume > 0 ? bestVolume : null,
    });
  }
  return records;
}

function better(current: number | null, previous: number | null): boolean {
  if (current == null || !(current > 0)) return false;
  if (previous == null) return true;
  return current > previous;
}

/** Compare this session with earlier logged sets. A set with reps counts; an empty row does not. */
export function detectNewPersonalRecords(
  history: RecordedSet[],
  session: RecordedSet[],
): NewPersonalRecord[] {
  const previous = recordsFromSets(history);
  const current = recordsFromSets(session);
  const previousByKey = new Map(previous.map((record) => [record.exerciseKey, record]));
  const found: NewPersonalRecord[] = [];

  for (const record of current) {
    const prior = previousByKey.get(record.exerciseKey);
    const checks: [NewPersonalRecord['kind'], number | null, number | null][] = [
      ['weight', record.bestWeightKg, prior?.bestWeightKg ?? null],
      ['reps', record.bestReps, prior?.bestReps ?? null],
      ['e1rm', record.bestE1rmKg, prior?.bestE1rmKg ?? null],
      ['volume', record.bestSessionVolumeKg, prior?.bestSessionVolumeKg ?? null],
    ];
    for (const [kind, value, old] of checks) {
      if (value != null && better(value, old ?? null)) {
        found.push({
          exerciseKey: record.exerciseKey,
          exerciseName: record.exerciseName,
          kind,
          value,
          previous: old ?? null,
        });
      }
    }
  }
  return found;
}
