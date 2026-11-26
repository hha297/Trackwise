/* eslint-disable import/first -- vi.mock must load before the module under test */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

import {
  companionPrefsKey,
  emptyCompanionPrefs,
  loadCompanionPrefs,
  markComebackShown,
  markDismissed,
  markTipShown,
  parseCompanionPrefs,
  saveCompanionPrefs,
} from './prefs';

describe('companion prefs storage', () => {
  beforeEach(() => {
    store.clear();
  });

  it('scopes keys by user id', () => {
    expect(companionPrefsKey('user-a')).not.toBe(companionPrefsKey('user-b'));
  });

  it('round-trips dismissals, tips, and comeback completion', async () => {
    const userId = 'user-a';
    let prefs = emptyCompanionPrefs();
    prefs = markDismissed(prefs, 'log_food:2026-11-16', '2026-11-16');
    prefs = markTipShown(prefs, 'habit_streak', '2026-11-16');
    prefs = markComebackShown(prefs, '2026-11-01', '2026-11-16');
    await saveCompanionPrefs(userId, prefs);

    const loaded = await loadCompanionPrefs(userId);
    expect(loaded.dismissed['log_food:2026-11-16']).toBe('2026-11-16');
    expect(loaded.tipsShown.habit_streak).toBe('2026-11-16');
    expect(loaded.comeback).toEqual({ lastActivityAtShow: '2026-11-01', shownOn: '2026-11-16' });

    const other = await loadCompanionPrefs('user-b');
    expect(other).toEqual(emptyCompanionPrefs());
  });

  it('resets corrupt payloads instead of throwing', () => {
    expect(parseCompanionPrefs('{nope')).toEqual(emptyCompanionPrefs());
    expect(parseCompanionPrefs(JSON.stringify({ version: 2 }))).toEqual(emptyCompanionPrefs());
  });
});
