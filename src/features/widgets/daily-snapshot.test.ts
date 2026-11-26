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
    expect(snap.caloriesRatio.replace(/,/g, '')).toBe('500 / 2000 kcal');
    expect(snap.caloriesPercent).toBe('25%');
    expect(snap.remainingValue.replace(/,/g, '')).toBe('1700');
    expect(snap.caloriesRemainingLine.toLowerCase()).toContain('left');
    expect(snap.remainingLabel.toLowerCase()).not.toContain('-');
    expect(snap.caloriesProgress).toBe(0.25);
    expect(snap.openUrl).toBe('trackwise:///');
    expect(snap.proteinDetail).toContain('g');
    expect(snap.proteinRatio).toMatch(/20 \/ \d+ g/);
    expect(snap.proteinRemainingLine.toLowerCase()).toContain('remaining');
    expect(snap.carbsRatio).toMatch(/60 \/ \d+ g/);
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
    expect(snap.caloriesRatio).toBe('0');
    expect(snap.caloriesProgress).toBe(0);
    expect(snap.caloriesRemainingLine).toBe('');
    expect(snap.hint.length).toBeGreaterThan(0);
  });

  it('treats a zero calorie target as missing instead of dividing by zero', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      locale: 'en',
      goal: { daily_calorie_target: 0 } as never,
      foodEntries: [
        {
          id: '1',
          logged_on: '2026-11-15',
          meal_type: 'lunch',
          quantity: 1,
          food_name: 'Rice',
          calories: 400,
          protein_g: 8,
          carbs_g: 80,
          fat_g: 2,
        } as never,
      ],
    });
    expect(snap.caloriesValue).toBe('400');
    expect(snap.caloriesProgress).toBe(0);
    expect(snap.remainingValue).toBe('—');
    expect(snap.hint.length).toBeGreaterThan(0);
  });

  it('keeps overflow numbers and caps the calorie ring at 100%', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      locale: 'en',
      goal: { daily_calorie_target: 2000 } as never,
      foodEntries: [
        {
          id: '1',
          logged_on: '2026-11-15',
          meal_type: 'dinner',
          quantity: 1,
          food_name: 'Feast',
          calories: 2600,
          protein_g: 90,
          carbs_g: 220,
          fat_g: 80,
        } as never,
      ],
    });
    expect(snap.caloriesValue).toBe('2,600');
    expect(snap.caloriesRatio.replace(/,/g, '')).toBe('2600 / 2000 kcal');
    expect(snap.caloriesProgress).toBe(1);
    expect(snap.caloriesPercent).toBe('100%');
    expect(snap.remainingLabel.toLowerCase()).toContain('over');
    expect(snap.remainingValue).not.toMatch(/-/);
    expect(snap.caloriesRemainingLine.toLowerCase()).toContain('over');
  });

  it('ignores food logged on another local diary day', () => {
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-16',
      locale: 'en',
      goal: { daily_calorie_target: 2000 } as never,
      foodEntries: [
        {
          id: 'yesterday',
          logged_on: '2026-11-15',
          meal_type: 'dinner',
          quantity: 1,
          food_name: 'Pizza',
          calories: 900,
          protein_g: 30,
          carbs_g: 90,
          fat_g: 30,
        } as never,
        {
          id: 'today',
          logged_on: '2026-11-16',
          meal_type: 'breakfast',
          quantity: 1,
          food_name: 'Eggs',
          calories: 180,
          protein_g: 14,
          carbs_g: 2,
          fat_g: 12,
        } as never,
      ],
    });
    expect(snap.caloriesValue).toBe('180');
    expect(snap.caloriesRatio.replace(/,/g, '')).toContain('180 / 2000');
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

  it('uses a same-day calorie override without rewriting the stored goal object', () => {
    const goal = { daily_calorie_target: 2000 } as never;
    const snap = buildDailyWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      locale: 'en',
      goal,
      calorieTargetOverride: 2200,
      foodEntries: [
        {
          id: '1',
          logged_on: '2026-11-15',
          meal_type: 'lunch',
          quantity: 1,
          food_name: 'Rice',
          calories: 200,
          protein_g: 4,
          carbs_g: 40,
          fat_g: 1,
        } as never,
      ],
    });
    expect(snap.remainingValue.replace(/,/g, '')).toBe('2000');
    expect((goal as { daily_calorie_target: number }).daily_calorie_target).toBe(2000);
  });
});
