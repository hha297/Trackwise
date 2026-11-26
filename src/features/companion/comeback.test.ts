import { describe, expect, it } from 'vitest';

import { evaluateComeback } from './comeback';
import { COMEBACK_INACTIVITY_DAYS } from './constants';

const TODAY = '2026-11-16';

describe('evaluateComeback', () => {
  it('does not treat a brand-new user as returning', () => {
    const decision = evaluateComeback({
      todayKey: TODAY,
      lastMeaningfulActivityKey: null,
      previous: null,
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toBe('new_user');
  });

  it('does not show for an active user (activity today)', () => {
    const decision = evaluateComeback({
      todayKey: TODAY,
      lastMeaningfulActivityKey: TODAY,
      previous: null,
    });
    expect(decision.reason).toBe('active');
    expect(decision.eligible).toBe(false);
  });

  it('does not show below the inactivity threshold', () => {
    const decision = evaluateComeback({
      todayKey: TODAY,
      lastMeaningfulActivityKey: '2026-11-12',
      previous: null,
    });
    expect(decision.inactiveDays).toBe(4);
    expect(decision.inactiveDays).toBeLessThan(COMEBACK_INACTIVITY_DAYS);
    expect(decision.reason).toBe('below_threshold');
  });

  it('is eligible after the configured threshold', () => {
    const decision = evaluateComeback({
      todayKey: TODAY,
      lastMeaningfulActivityKey: '2026-11-09',
      previous: null,
    });
    expect(decision.inactiveDays).toBe(7);
    expect(decision.eligible).toBe(true);
    expect(decision.reason).toBe('eligible');
  });

  it('does not show again for the same inactivity period', () => {
    const decision = evaluateComeback({
      todayKey: TODAY,
      lastMeaningfulActivityKey: '2026-11-01',
      previous: { lastActivityAtShow: '2026-11-01', shownOn: '2026-11-15' },
    });
    expect(decision.reason).toBe('already_shown');
    expect(decision.eligible).toBe(false);
  });

  it('shows again after a new activity then another long gap', () => {
    const decision = evaluateComeback({
      todayKey: TODAY,
      lastMeaningfulActivityKey: '2026-11-02',
      previous: { lastActivityAtShow: '2026-10-01', shownOn: '2026-10-20' },
    });
    expect(decision.eligible).toBe(true);
  });

  it('uses calendar days so timezone midnight is a diary key, not a UTC slice', () => {
    const decision = evaluateComeback({
      todayKey: '2026-11-16',
      lastMeaningfulActivityKey: '2026-11-09',
      previous: null,
    });
    expect(decision.inactiveDays).toBe(7);
  });
});
