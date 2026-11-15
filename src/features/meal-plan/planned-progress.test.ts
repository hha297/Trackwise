import { describe, expect, it } from 'vitest';

import { plannedProgress } from './planned-progress';

describe('plannedProgress', () => {
  it('returns null ratio when target missing', () => {
    expect(plannedProgress(100, null)).toEqual({
      planned: 100,
      target: null,
      ratio: null,
      overTarget: false,
    });
  });

  it('returns null ratio when target is zero', () => {
    expect(plannedProgress(50, 0).ratio).toBeNull();
  });

  it('handles zero planned under target', () => {
    expect(plannedProgress(0, 2000)).toEqual({
      planned: 0,
      target: 2000,
      ratio: 0,
      overTarget: false,
    });
  });

  it('clamps ratio at 1 when over target', () => {
    expect(plannedProgress(2500, 2000)).toEqual({
      planned: 2500,
      target: 2000,
      ratio: 1,
      overTarget: true,
    });
  });

  it('computes partial progress', () => {
    expect(plannedProgress(500, 2000).ratio).toBe(0.25);
  });

  it('treats null planned as zero', () => {
    expect(plannedProgress(null, 100).planned).toBe(0);
  });
});
