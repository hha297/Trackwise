export const QUICK_ADD_ML = [250, 500, 750] as const;
export const DEFAULT_HYDRATION_TARGET_ML = 2500;
export const MIN_HYDRATION_ML = 1;
export const MAX_HYDRATION_ML = 5000;
export const MIN_TARGET_ML = 250;
export const MAX_TARGET_ML = 10000;

const ML_PER_FL_OZ = 29.5735295625;

export type HydrationEntry = {
  id: string;
  loggedOn: string;
  amountMl: number;
};

export function isValidIntakeMl(amountMl: number): boolean {
  return Number.isInteger(amountMl) && amountMl >= MIN_HYDRATION_ML && amountMl <= MAX_HYDRATION_ML;
}

export function isValidTargetMl(amountMl: number): boolean {
  return Number.isInteger(amountMl) && amountMl >= MIN_TARGET_ML && amountMl <= MAX_TARGET_ML;
}

export function mlToFlOz(ml: number): number {
  return Math.round((ml / ML_PER_FL_OZ) * 10) / 10;
}

export function flOzToMl(flOz: number): number {
  return Math.round(flOz * ML_PER_FL_OZ);
}

/** Sum intake for one local diary date. Entries on other dates never leak in. */
export function intakeForDate(entries: HydrationEntry[], dateKey: string): number {
  return entries.reduce(
    (sum, entry) => (entry.loggedOn === dateKey ? sum + entry.amountMl : sum),
    0,
  );
}

export function weekIntake(
  entries: HydrationEntry[],
  dateKeys: string[],
): { dateKey: string; amountMl: number }[] {
  return dateKeys.map((dateKey) => ({ dateKey, amountMl: intakeForDate(entries, dateKey) }));
}

export function progressRatio(amountMl: number, targetMl: number): number {
  if (!(targetMl > 0)) return 0;
  return amountMl / targetMl;
}
