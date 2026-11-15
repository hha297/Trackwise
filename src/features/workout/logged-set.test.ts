import { describe, expect, it } from 'vitest';

import { draftSetIsLogged } from './logged-set';

describe('draftSetIsLogged', () => {
  it('counts a set that has any logged number', () => {
    expect(draftSetIsLogged({ weightKg: '80', reps: '5' })).toBe(true);
    expect(draftSetIsLogged({ reps: '12' })).toBe(true);
    expect(draftSetIsLogged({ durationSec: '30' })).toBe(true);
  });

  it('ignores an empty row', () => {
    expect(draftSetIsLogged({ weightKg: '', reps: '', durationSec: '', distanceM: '' })).toBe(false);
    expect(draftSetIsLogged({ weightKg: '0', reps: '0' })).toBe(false);
  });
});
