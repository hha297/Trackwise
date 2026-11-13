/* eslint-disable import/first -- vi.mock must load before the module under test */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  },
}));

import { DEFAULT_REMINDER_PREFERENCES } from './defaults';
import {
  loadReminderPreferences,
  normalizeReminderPreferences,
  REMINDER_PREFS_STORAGE_KEY,
  saveReminderPreferences,
} from './preferences';

describe('normalizeReminderPreferences', () => {
  it('returns defaults for invalid payloads', () => {
    expect(normalizeReminderPreferences(null)).toEqual(DEFAULT_REMINDER_PREFERENCES);
    expect(normalizeReminderPreferences({ version: 99 })).toEqual(DEFAULT_REMINDER_PREFERENCES);
  });

  it('dedupes workout weekdays', () => {
    const normalized = normalizeReminderPreferences({
      ...DEFAULT_REMINDER_PREFERENCES,
      workout: {
        enabled: true,
        time: { hour: 7, minute: 0 },
        weekdays: [1, 1, 3, 3],
      },
    });
    expect(normalized.workout.weekdays).toEqual([1, 3]);
  });
});

describe('reminder preference persistence', () => {
  beforeEach(() => {
    store.clear();
  });

  it('loads defaults when nothing is stored', async () => {
    await expect(loadReminderPreferences()).resolves.toEqual(DEFAULT_REMINDER_PREFERENCES);
  });

  it('round-trips saved preferences', async () => {
    const next = {
      ...DEFAULT_REMINDER_PREFERENCES,
      hydration: {
        ...DEFAULT_REMINDER_PREFERENCES.hydration,
        enabled: true,
        intervalMinutes: 90,
      },
    };
    await saveReminderPreferences(next);
    expect(store.get(REMINDER_PREFS_STORAGE_KEY)).toBeTruthy();
    await expect(loadReminderPreferences()).resolves.toMatchObject({
      hydration: { enabled: true, intervalMinutes: 90 },
    });
  });

  it('recovers from corrupted storage', async () => {
    store.set(REMINDER_PREFS_STORAGE_KEY, '{not-json');
    await expect(loadReminderPreferences()).resolves.toEqual(DEFAULT_REMINDER_PREFERENCES);
  });
});
