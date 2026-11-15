import type { TFunction } from 'i18next';

/** Prefer specific muscle labels; drop redundant pairs like core+abs. */
export function dedupeMuscleList(muscles: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of muscles ?? []) {
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  if (seen.has('core') && seen.has('abs')) {
    return result.filter((m) => m !== 'core');
  }
  if (seen.has('back') && seen.has('lats')) {
    return result.filter((m) => m !== 'back');
  }
  return result;
}

export function formatMuscleLabel(muscle: string, t: TFunction): string {
  const key = muscle.trim().toLowerCase();
  const translated = t(`workout.muscle.${key}`, { defaultValue: '' });
  if (translated) return translated;
  return titleCaseWords(key);
}

export function formatMuscleList(muscles: string[] | null | undefined, t: TFunction): string {
  return dedupeMuscleList(muscles)
    .map((m) => formatMuscleLabel(m, t))
    .join(', ');
}

export function formatEquipmentLabel(equipment: string | null | undefined, t: TFunction): string {
  if (!equipment || equipment === 'none') {
    return t('workout.equipment.none');
  }
  const key = equipment.trim().toLowerCase();
  const translated = t(`workout.equipment.${key}`, { defaultValue: '' });
  if (translated) return translated;
  return equipment.trim();
}

export function formatMovementPattern(
  pattern: string | null | undefined,
  t: TFunction,
): string | null {
  if (!pattern?.trim()) return null;
  const key = pattern.trim().toLowerCase();
  const known = t(`workout.movement.${key}`, { defaultValue: '' });
  if (known) return known;
  return titleCaseWords(key);
}

export function titleCaseWords(value: string): string {
  return value
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
