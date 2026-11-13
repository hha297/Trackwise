import { describe, expect, it } from 'vitest';

import { parseReminderDeepLink } from './deep-link';

describe('parseReminderDeepLink', () => {
  it('accepts Trackwise workout/meal/hydration payloads', () => {
    expect(parseReminderDeepLink({ trackwise: true, kind: 'workout' })).toEqual({
      kind: 'workout',
    });
    expect(
      parseReminderDeepLink({ trackwise: true, kind: 'meal', meal: 'lunch' }),
    ).toEqual({ kind: 'meal', meal: 'lunch' });
    expect(parseReminderDeepLink({ trackwise: true, kind: 'hydration' })).toEqual({
      kind: 'hydration',
    });
  });

  it('rejects foreign or invalid payloads', () => {
    expect(parseReminderDeepLink(null)).toBeNull();
    expect(parseReminderDeepLink({ kind: 'workout' })).toBeNull();
    expect(parseReminderDeepLink({ trackwise: true, kind: 'meal', meal: 'snack' })).toBeNull();
  });
});
