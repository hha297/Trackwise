import { describe, expect, it } from 'vitest';

import {
  parsePersonalMilestoneInput,
  PERSONAL_MILESTONE_MIN,
  personalMilestoneStorageKey,
} from '@/features/engagement/personal-milestone';

describe('parsePersonalMilestoneInput', () => {
  it('accepts integers from the minimum upward', () => {
    expect(parsePersonalMilestoneInput(String(PERSONAL_MILESTONE_MIN))).toBe(
      PERSONAL_MILESTONE_MIN,
    );
    expect(parsePersonalMilestoneInput('150')).toBe(150);
  });

  it('rejects below minimum, non-integers, and empty', () => {
    expect(parsePersonalMilestoneInput('100')).toBeNull();
    expect(parsePersonalMilestoneInput('12.5')).toBeNull();
    expect(parsePersonalMilestoneInput('')).toBeNull();
    expect(parsePersonalMilestoneInput('abc')).toBeNull();
  });
});

describe('personalMilestoneStorageKey', () => {
  it('scopes by user id', () => {
    expect(personalMilestoneStorageKey('user-1')).toContain('user-1');
  });
});
