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
  /** ISO timestamptz from insert — used for HH:mm in the day log. */
  createdAt: string;
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

/** Fixed chart plot height (px) — bars scale inside this, never grow the layout. */
export const HYDRATION_CHART_HEIGHT = 140;

/** Fallback Y scale when a day has no daily goal yet. */
export const EMPTY_WEEK_CHART_SCALE_ML = 2000;

/**
 * Y-axis top is the daily goal so bars zoom to that target.
 * A day above the goal raises the scale so the bar still fits.
 */
export function weekChartScaleMax(amountsMl: number[], goalMl?: number): number {
  const peak = Math.max(0, ...amountsMl);
  const goal = goalMl != null && goalMl > 0 ? goalMl : EMPTY_WEEK_CHART_SCALE_ML;
  if (peak <= goal) return goal;
  return niceCeilMl(peak);
}

/** Round up to a clean ml tick so the tallest bar fits under a fixed chart height. */
export function niceCeilMl(value: number): number {
  if (!(value > 0)) return 500;
  if (value <= 500) return 500;
  if (value <= 1000) return 1000;
  if (value <= 2000) return 2000;
  if (value <= 3000) return 3000;
  if (value <= 4000) return 4000;
  if (value <= 5000) return 5000;
  const step = value <= 10000 ? 1000 : 2000;
  return Math.ceil(value / step) * step;
}

export function weekChartYTicks(scaleMaxMl: number): number[] {
  const max = Math.max(1, scaleMaxMl);
  return [0, Math.round(max / 2), max];
}
