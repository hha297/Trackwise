import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'trackwise.consistency.personalMilestone.';

/** Personal next goal after unlocking the 100-day milestone. */
export const PERSONAL_MILESTONE_MIN = 101;
export const PERSONAL_MILESTONE_MAX = 999;

export function personalMilestoneStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function parsePersonalMilestoneInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value)) return null;
  if (value < PERSONAL_MILESTONE_MIN || value > PERSONAL_MILESTONE_MAX) return null;
  return value;
}

export async function loadPersonalMilestone(userId: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(personalMilestoneStorageKey(userId));
  if (!raw) return null;
  return parsePersonalMilestoneInput(raw);
}

export async function savePersonalMilestone(
  userId: string,
  days: number,
): Promise<void> {
  if (days < PERSONAL_MILESTONE_MIN || days > PERSONAL_MILESTONE_MAX) {
    throw new Error('Invalid personal milestone');
  }
  await AsyncStorage.setItem(personalMilestoneStorageKey(userId), String(days));
}

export async function clearPersonalMilestone(userId: string): Promise<void> {
  await AsyncStorage.removeItem(personalMilestoneStorageKey(userId));
}
