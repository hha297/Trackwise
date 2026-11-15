export function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.round(value * 1000) / 1000;
}

export function progressAgainstTarget(consumed: number, target: number): number {
  if (!(target > 0) || !Number.isFinite(consumed)) return 0;
  return clamp01(consumed / target);
}

export function formatCompactNumber(value: number, locale: string): string {
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

/** MacroFactor-style "74% • 56 g" line from existing progress + amount. */
export function formatPercentDetail(progress: number, amountLabel: string): string {
  const pct = Math.round(clamp01(progress) * 100);
  return `${pct}% \u2022 ${amountLabel}`;
}

/** Card headline "20/130 g" from already-computed consumed and target. */
export function formatConsumedTarget(
  consumed: number,
  target: number,
  unit: string,
  locale: string,
): string {
  return `${formatCompactNumber(consumed, locale)}/${formatCompactNumber(target, locale)} ${unit}`;
}
