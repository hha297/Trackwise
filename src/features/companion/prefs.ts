import AsyncStorage from '@react-native-async-storage/async-storage';

import { COMPANION_STORAGE_PREFIX } from './constants';
import type { ComebackState, CompanionPrefs } from './types';

export function companionPrefsKey(userId: string): string {
  return `${COMPANION_STORAGE_PREFIX}${userId}`;
}

export function emptyCompanionPrefs(): CompanionPrefs {
  return { version: 1, dismissed: {}, comeback: null, tipsShown: {} };
}

export function parseCompanionPrefs(raw: string | null): CompanionPrefs {
  if (!raw) return emptyCompanionPrefs();
  try {
    const parsed = JSON.parse(raw) as Partial<CompanionPrefs>;
    if (parsed.version !== 1 || typeof parsed !== 'object' || parsed == null) {
      return emptyCompanionPrefs();
    }
    return {
      version: 1,
      dismissed: isStringRecord(parsed.dismissed) ? parsed.dismissed : {},
      comeback: parseComeback(parsed.comeback),
      tipsShown: isStringRecord(parsed.tipsShown) ? parsed.tipsShown : {},
    };
  } catch {
    return emptyCompanionPrefs();
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every((item) => typeof item === 'string');
}

function parseComeback(value: unknown): ComebackState | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as ComebackState;
  if (typeof row.lastActivityAtShow !== 'string' || typeof row.shownOn !== 'string') return null;
  return { lastActivityAtShow: row.lastActivityAtShow, shownOn: row.shownOn };
}

export async function loadCompanionPrefs(userId: string): Promise<CompanionPrefs> {
  const raw = await AsyncStorage.getItem(companionPrefsKey(userId));
  return parseCompanionPrefs(raw);
}

export async function saveCompanionPrefs(userId: string, prefs: CompanionPrefs): Promise<void> {
  await AsyncStorage.setItem(companionPrefsKey(userId), JSON.stringify(prefs));
}

export function dismissedIdSet(prefs: CompanionPrefs): Set<string> {
  return new Set(Object.keys(prefs.dismissed));
}

export function markDismissed(
  prefs: CompanionPrefs,
  id: string,
  todayKey: string,
): CompanionPrefs {
  return {
    ...prefs,
    dismissed: { ...prefs.dismissed, [id]: todayKey },
  };
}

export function markTipShown(prefs: CompanionPrefs, tipId: string, todayKey: string): CompanionPrefs {
  return {
    ...prefs,
    tipsShown: { ...prefs.tipsShown, [tipId]: todayKey },
  };
}

export function markComebackShown(
  prefs: CompanionPrefs,
  lastActivityKey: string,
  todayKey: string,
): CompanionPrefs {
  return {
    ...prefs,
    comeback: { lastActivityAtShow: lastActivityKey, shownOn: todayKey },
  };
}
