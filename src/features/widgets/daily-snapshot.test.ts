import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => import('./widget-i18n.mock'));

import { buildDailyWidgetSnapshot } from './daily-snapshot';

describe('buildDailyWidgetSnapshot', () => {

  it('does not show previous-user numbers when signed out', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: false,
      foodEntries: [
        {
          id: '1',
          logged_on: '2026-11-15',
          meal_type: 'lunch',
          quantity: 1,
          food_name: 'Secret',
          calories: 900,
          protein_g: 40,
          carbs_g: 80,
          fat_g: 20,
        } as never,
      ],
    });
    expect(snap.signedIn).toBe(false);
    expect(snap.colorScheme).toBe('light');
    expect(snap.caloriesValue).toBe('—');
    expect(snap.hint.toLowerCase()).toContain('sign in');
  });

  it('uses diary calorie remaining (target - consumed + burned)', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      locale: 'en',
      goal: { daily_calorie_target: 2000 } as never,
      foodEntries: [
        {
          id: '1',
          logged_on: '2026-11-15',
          meal_type: 'breakfast',
          quantity: 1,
          food_name: 'Oats',
          calories: 500,
          protein_g: 20,
          carbs_g: 60,
          fat_g: 10,
        } as never,
      ],
      burnedCalories: 200,
    });
    expect(snap.caloriesValue).toBe('500');
    expect(snap.remainingValue.replace(/,/g, '')).toBe('1700');
    expect(snap.caloriesProgress).toBe(0.25);
    expect(snap.proteinDetail).toContain('g');
    expect(snap.proteinRatio).toMatch(/20\/\d+ g/);
    expect(snap.proteinRemainingLine.toLowerCase()).toContain('remaining');
    expect(snap.carbsRatio).toMatch(/60\/\d+ g/);
    expect(snap.waterRemainingLine.toLowerCase()).toMatch(/ml (remaining|over)/);
  });

  it('keeps zeros readable when the day has no logs', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      locale: 'en',
      goal: { daily_calorie_target: 1800 } as never,
      foodEntries: [],
      hydrationEntries: [],
    });
    expect(snap.caloriesValue).toBe('0');
    expect(snap.remainingValue.replace(/,/g, '')).toBe('1800');
    expect(snap.waterProgress).toBe(0);
  });

  it('shows a hint instead of inventing a calorie target', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      locale: 'en',
      goal: null,
      foodEntries: [],
    });
    expect(snap.remainingValue).toBe('—');
    expect(snap.hint.length).toBeGreaterThan(0);
  });

  it('counts a current streak from persisted activity days, not leftover logs', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      locale: 'en',
      goal: { daily_calorie_target: 2000 } as never,
      nutritionDayKeys: ['2026-11-13', '2026-11-14', '2026-11-15'],
      foodEntries: [],
    });
    expect(snap.showStreak).toBe(true);
    expect(snap.streakValue).toContain('3');
  });

  it('keeps signed-in privacy when a snapshot cannot be built', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      unavailable: true,
      foodEntries: [
        {
          id: '1',
          logged_on: '2026-11-15',
          meal_type: 'lunch',
          quantity: 1,
          food_name: 'Secret',
          calories: 900,
          protein_g: 40,
          carbs_g: 80,
          fat_g: 20,
        } as never,
      ],
    });
    expect(snap.signedIn).toBe(true);
    expect(snap.caloriesValue).toBe('—');
    expect(snap.hint.length).toBeGreaterThan(0);
  });

  it('forwards the app color scheme onto the snapshot', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      colorScheme: 'dark',
      todayKey: '2026-11-15',
      locale: 'en',
      goal: { daily_calorie_target: 1800 } as never,
    });
    expect(snap.colorScheme).toBe('dark');
  });

  it('uses local diary dates for water, not UTC slicing', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      locale: 'en',
      goal: { daily_calorie_target: 2000 } as never,
      hydrationTargetMl: 2500,
      hydrationEntries: [
        { id: 'a', loggedOn: '2026-11-15', amountMl: 500, createdAt: '2026-11-15T23:30:00.000Z' },
        { id: 'b', loggedOn: '2026-11-14', amountMl: 900, createdAt: '2026-11-14T10:00:00.000Z' },
      ],
    });
    expect(snap.waterValue).toContain('500');
    expect(snap.waterValue).not.toContain('1400');
  });
});
