import { describe, expect, it } from 'vitest';

import { DEFAULT_REMINDER_PREFERENCES } from './defaults';
import {
  buildHydrationSlots,
  buildReminderPlan,
  diffReminderSchedules,
  fullReplaceTargets,
  isoWeekdayToExpo,
  parseTimeOfDay,
  type ReminderCopy,
} from './schedule-plan';
import type { ReminderPreferences } from './types';

const copy: ReminderCopy = {
  workout: { title: 'Workout', body: 'Time for a session' },
  meals: {
    breakfast: { title: 'Breakfast', body: 'Log breakfast' },
    lunch: { title: 'Lunch', body: 'Log lunch' },
    dinner: { title: 'Dinner', body: 'Log dinner' },
  },
  hydration: { title: 'Water', body: 'Have a drink' },
};

function prefs(partial: Partial<ReminderPreferences> = {}): ReminderPreferences {
  return {
    ...structuredClone(DEFAULT_REMINDER_PREFERENCES),
    ...partial,
    workout: {
      ...DEFAULT_REMINDER_PREFERENCES.workout,
      ...(partial.workout ?? {}),
    },
    meals: {
      ...structuredClone(DEFAULT_REMINDER_PREFERENCES.meals),
      ...(partial.meals ?? {}),
    },
    hydration: {
      ...DEFAULT_REMINDER_PREFERENCES.hydration,
      ...(partial.hydration ?? {}),
    },
  };
}

describe('isoWeekdayToExpo', () => {
  it('maps Monday–Sunday to Expo Sunday-based weekdays', () => {
    expect(isoWeekdayToExpo(1)).toBe(2); // Mon
    expect(isoWeekdayToExpo(7)).toBe(1); // Sun
    expect(isoWeekdayToExpo(5)).toBe(6); // Fri
  });
});

describe('buildHydrationSlots', () => {
  it('builds slots inside the window and skips outside', () => {
    const slots = buildHydrationSlots(
      { hour: 9, minute: 0 },
      { hour: 15, minute: 0 },
      120,
    );
    expect(slots.map((s) => `${s.hour}:${s.minute}`)).toEqual([
      '9:0',
      '11:0',
      '13:0',
      '15:0',
    ]);
  });

  it('returns empty for inverted windows or tiny intervals', () => {
    expect(
      buildHydrationSlots({ hour: 18, minute: 0 }, { hour: 9, minute: 0 }, 60),
    ).toEqual([]);
    expect(
      buildHydrationSlots({ hour: 9, minute: 0 }, { hour: 18, minute: 0 }, 15),
    ).toEqual([]);
  });

  it('caps excessive hydration reminders', () => {
    const slots = buildHydrationSlots(
      { hour: 6, minute: 0 },
      { hour: 22, minute: 0 },
      30,
      12,
    );
    expect(slots).toHaveLength(12);
  });
});

describe('buildReminderPlan', () => {
  it('creates no schedules when everything is disabled', () => {
    expect(buildReminderPlan(prefs(), copy)).toEqual([]);
  });

  it('schedules workout reminders only for selected weekdays', () => {
    const plan = buildReminderPlan(
      prefs({
        workout: {
          enabled: true,
          time: { hour: 18, minute: 0 },
          weekdays: [1, 3],
        },
      }),
      copy,
    );
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.expoWeekday).sort()).toEqual([2, 4]);
    expect(plan.every((p) => p.hour === 18 && p.minute === 0)).toBe(true);
  });

  it('creates no workout schedules when enabled but weekdays empty', () => {
    const plan = buildReminderPlan(
      prefs({
        workout: { enabled: true, time: { hour: 18, minute: 0 }, weekdays: [] },
      }),
      copy,
    );
    expect(plan.filter((p) => p.data.kind === 'workout')).toHaveLength(0);
  });

  it('enables meal reminders independently', () => {
    const plan = buildReminderPlan(
      prefs({
        meals: {
          breakfast: { enabled: true, time: { hour: 8, minute: 0 } },
          lunch: { enabled: false, time: { hour: 12, minute: 30 } },
          dinner: { enabled: true, time: { hour: 19, minute: 0 } },
        },
      }),
      copy,
    );
    const meals = plan.filter((p) => p.data.kind === 'meal');
    expect(meals).toHaveLength(2);
    expect(meals.map((p) => (p.data.kind === 'meal' ? p.data.meal : null))).toEqual([
      'breakfast',
      'dinner',
    ]);
  });

  it('schedules hydration only within the configured window', () => {
    const plan = buildReminderPlan(
      prefs({
        hydration: {
          enabled: true,
          intervalMinutes: 120,
          windowStart: { hour: 10, minute: 0 },
          windowEnd: { hour: 14, minute: 0 },
        },
      }),
      copy,
    );
    const hydrate = plan.filter((p) => p.data.kind === 'hydration');
    expect(hydrate.map((p) => `${p.hour}:${p.minute}`)).toEqual(['10:0', '12:0', '14:0']);
  });
});

describe('schedule diff / replace', () => {
  it('cancels only Trackwise-owned ids and replaces desired set', () => {
    const desired = buildReminderPlan(
      prefs({
        meals: {
          breakfast: { enabled: true, time: { hour: 8, minute: 0 } },
          lunch: { enabled: false, time: { hour: 12, minute: 0 } },
          dinner: { enabled: false, time: { hour: 18, minute: 0 } },
        },
      }),
      copy,
    );
    const { toCancel, toSchedule } = fullReplaceTargets(desired, [
      'trackwise.reminder.meal.breakfast',
      'trackwise.reminder.hydrate.0900',
      'other.app.notification',
    ]);
    expect(toCancel).toEqual([
      'trackwise.reminder.meal.breakfast',
      'trackwise.reminder.hydrate.0900',
    ]);
    expect(toSchedule).toHaveLength(1);
    expect(toSchedule[0]?.identifier).toBe('trackwise.reminder.meal.breakfast');
  });

  it('diff is idempotent for matching ids', () => {
    const desired = buildReminderPlan(
      prefs({
        meals: {
          breakfast: { enabled: true, time: { hour: 8, minute: 0 } },
          lunch: { enabled: false, time: { hour: 12, minute: 0 } },
          dinner: { enabled: false, time: { hour: 18, minute: 0 } },
        },
      }),
      copy,
    );
    const ids = desired.map((d) => d.identifier);
    const first = diffReminderSchedules(desired, ids);
    expect(first.toSchedule).toHaveLength(0);
    expect(first.toCancel).toHaveLength(0);
    const second = diffReminderSchedules(desired, ids);
    expect(second).toEqual(first);
  });
});

describe('parseTimeOfDay', () => {
  it('parses and rejects invalid times', () => {
    expect(parseTimeOfDay('08:30')).toEqual({ hour: 8, minute: 30 });
    expect(parseTimeOfDay('25:00')).toBeNull();
    expect(parseTimeOfDay('nope')).toBeNull();
  });
});
