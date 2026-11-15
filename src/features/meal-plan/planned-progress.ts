export type PlannedProgress = {
  planned: number;
  target: number | null;
  /** 0–1 for bar fill when target is valid; null when no progress bar should render. */
  ratio: number | null;
  overTarget: boolean;
};

/**
 * Planned vs target progress for Meal Plan overview.
 * Missing/zero/invalid targets → absolute planned only (ratio null).
 */
export function plannedProgress(
  plannedRaw: number | null | undefined,
  targetRaw: number | null | undefined,
): PlannedProgress {
  const planned =
    plannedRaw == null || !Number.isFinite(plannedRaw) ? 0 : Math.max(0, plannedRaw);
  const target =
    targetRaw == null || !Number.isFinite(targetRaw) || targetRaw <= 0 ? null : targetRaw;

  if (target == null) {
    return { planned, target: null, ratio: null, overTarget: false };
  }

  const ratio = Math.min(1, planned / target);
  return {
    planned,
    target,
    ratio,
    overTarget: planned > target,
  };
}
