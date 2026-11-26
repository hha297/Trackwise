export function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.round(value * 1000) / 1000;
}

export function progressAgainstTarget(consumed: number, target: number): number {
  if (!(target > 0) || !Number.isFinite(consumed)) return 0;
  return clamp01(consumed / target);
}

/** Remaining toward a daily target. Null when the target cannot be used. */
export function remainingTowardTarget(consumed: number, target: number): number | null {
  if (!Number.isFinite(consumed) || !Number.isFinite(target) || !(target > 0)) return null;
  return target - consumed;
}

export function isTargetExceeded(consumed: number, target: number): boolean {
  const remaining = remainingTowardTarget(consumed, target);
  return remaining != null && remaining < 0;
}

/** Absolute remaining/over amount for display. Never negative. */
export function displayRemainingMagnitude(consumed: number, target: number): number | null {
  const remaining = remainingTowardTarget(consumed, target);
  if (remaining == null) return null;
  return Math.abs(remaining);
}

export function formatCompactNumber(value: number, locale: string): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(rounded);
  } catch {
    return String(rounded);
  }
}

export function formatGrams(value: number, locale: string): string {
  return `${formatCompactNumber(value, locale)} g`;
}

export function formatPercentLabel(progress: number, locale: string): string {
  const pct = Math.round(clamp01(progress) * 100);
  try {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(pct)}%`;
  } catch {
    return `${pct}%`;
  }
}

/** MacroFactor-style "74% • 56 g" line from existing progress + amount. */
export function formatPercentDetail(progress: number, amountLabel: string): string {
  const pct = Math.round(clamp01(progress) * 100);
  return `${pct}% \u2022 ${amountLabel}`;
}

/** Card headline "20 / 130 g" from already-computed consumed and target. */
export function formatConsumedTarget(
  consumed: number,
  target: number,
  unit: string,
  locale: string,
): string {
  return `${formatCompactNumber(consumed, locale)} / ${formatCompactNumber(target, locale)} ${unit}`;
}
