function positive(value: string | number | null | undefined): boolean {
  if (value == null || value === '') return false;
  const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(number) && number > 0;
}

/** A set counts once it has weight, reps, time, or distance. No extra confirmation. */
export function draftSetIsLogged(set: {
  weightKg?: string | number | null;
  reps?: string | number | null;
  durationSec?: string | number | null;
  distanceM?: string | number | null;
}): boolean {
  return (
    positive(set.weightKg) ||
    positive(set.reps) ||
    positive(set.durationSec) ||
    positive(set.distanceM)
  );
}
