import { describe, expect, it } from 'vitest';

import { companionDismissKey, selectCompanionSuggestion } from './select-companion';
import { presentCompanionCard } from './presentation';
import type { CompanionInput, CompanionSuggestion } from './types';

const TODAY = '2026-11-16';

function base(overrides: Partial<CompanionInput> = {}): CompanionInput {
  return {
    todayKey: TODAY,
    dateKey: TODAY,
    hasGoal: true,
    calorieTarget: 2000,
    originalCalorieTarget: 2000,
    proteinTargetG: 150,
    consumedCalories: 0,
    consumedProteinG: 0,
    hasFoodLogsToday: false,
    completedWorkoutsToday: 0,
    todayPlan: null,
    overduePlans: [],
    hasWorkoutHistory: false,
    lastMeaningfulActivityKey: TODAY,
    dismissedIds: new Set(),
    tips: [],
    ...overrides,
  };
}

describe('selectCompanionSuggestion', () => {
  it('returns null for a past diary day', () => {
    expect(selectCompanionSuggestion(base({ dateKey: '2026-11-15' }))).toBeNull();
  });

  it('suggests logging food when nothing is logged', () => {
    const suggestion = selectCompanionSuggestion(base());
    expect(suggestion?.id).toBe('log_food');
    expect(suggestion?.cta.href).toBe('/food/add');
    expect(suggestion?.cta.params).toEqual({ intent: 'log', date: TODAY });
  });

  it('suggests remaining protein after partial food logs', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        hasFoodLogsToday: true,
        consumedCalories: 900,
        consumedProteinG: 40,
      }),
    );
    expect(suggestion?.id).toBe('protein_remaining');
    expect(suggestion?.params.grams).toBe(110);
  });

  it('does not suggest protein when remaining is under the threshold', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        hasFoodLogsToday: true,
        consumedCalories: 1800,
        consumedProteinG: 145,
        proteinTargetG: 150,
      }),
    );
    expect(suggestion?.id).not.toBe('protein_remaining');
  });

  it('acknowledges nutrition targets without encouraging restriction', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        hasFoodLogsToday: true,
        consumedCalories: 1980,
        consumedProteinG: 150,
      }),
    );
    expect(suggestion?.id).toBe('nutrition_complete');
    const presented = presentCompanionCard(suggestion!);
    expect(presented.bodyKey).toContain('nutritionComplete');
  });

  it('gives a close-to-target update before the day is classified achieved', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        hasFoodLogsToday: true,
        consumedCalories: 1750,
        consumedProteinG: 150,
      }),
    );
    expect(suggestion?.id).toBe('calories_close');
  });

  it('prioritizes today\'s scheduled workout over logging food', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        todayPlan: { kind: 'workout', title: 'Push', completedWorkoutId: null },
        hasFoodLogsToday: false,
      }),
    );
    expect(suggestion?.id).toBe('scheduled_workout');
    expect(suggestion?.cta.href).toBe('/(tabs)/workout');
  });

  it('does not suggest another workout after today\'s session is completed', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        todayPlan: { kind: 'workout', title: 'Push', completedWorkoutId: 'w1' },
        completedWorkoutsToday: 1,
        hasFoodLogsToday: true,
        consumedCalories: 500,
        consumedProteinG: 40,
      }),
    );
    expect(suggestion?.id).not.toBe('scheduled_workout');
    expect(suggestion?.id).not.toBe('optional_activity');
  });

  it('offers to reschedule an overdue workout when today is free', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        hasFoodLogsToday: true,
        consumedCalories: 500,
        consumedProteinG: 150,
        overduePlans: [{ planDate: '2026-11-14', title: 'Legs' }],
      }),
    );
    expect(suggestion?.id).toBe('overdue_workout');
    expect(suggestion?.cta.href).toBe('/workout/plan');
  });

  it('keeps today\'s scheduled workout above an overdue session', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        todayPlan: { kind: 'workout', title: 'Today', completedWorkoutId: null },
        overduePlans: [{ planDate: '2026-11-14', title: 'Yesterday' }],
      }),
    );
    expect(suggestion?.id).toBe('scheduled_workout');
  });

  it('suggests optional activity when there is history but no plan', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        hasFoodLogsToday: true,
        consumedCalories: 500,
        consumedProteinG: 150,
        hasWorkoutHistory: true,
      }),
    );
    expect(suggestion?.id).toBe('optional_activity');
  });

  it('does not invent a personalized workout for a brand-new user', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        hasGoal: false,
        lastMeaningfulActivityKey: null,
        hasWorkoutHistory: false,
      }),
    );
    expect(suggestion?.id).toBe('log_food');
  });

  it('skips a dismissed suggestion and picks the next', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        dismissedIds: new Set([companionDismissKey('log_food', TODAY)]),
        hasGoal: false,
        lastMeaningfulActivityKey: null,
      }),
    );
    expect(suggestion?.id).toBe('welcome');
  });

  it('changes after the suggested action is completed (data update)', () => {
    const before = selectCompanionSuggestion(base());
    expect(before?.id).toBe('log_food');
    const after = selectCompanionSuggestion(
      base({
        hasFoodLogsToday: true,
        consumedCalories: 600,
        consumedProteinG: 40,
      }),
    );
    expect(after?.id).toBe('protein_remaining');
  });

  it('lets a higher-priority operational card beat a matching tip', () => {
    const tip: CompanionSuggestion = {
      id: 'habit_streak',
      category: 'tip',
      priority: 4,
      dismissible: true,
      params: {},
      cta: { href: '/(tabs)/progress' },
    };
    const suggestion = selectCompanionSuggestion(base({ tips: [tip] }));
    expect(suggestion?.id).toBe('log_food');
  });

  it('acknowledges a planned rest day instead of pushing another workout', () => {
    const suggestion = selectCompanionSuggestion(
      base({
        hasFoodLogsToday: true,
        consumedCalories: 500,
        consumedProteinG: 150,
        todayPlan: { kind: 'rest', title: 'Rest', completedWorkoutId: null },
        hasWorkoutHistory: true,
      }),
    );
    expect(suggestion?.id).toBe('rest_day');
    expect(suggestion?.cta.href).toBe('/workout/plan');
  });

  it('uses local diary dates rather than inventing UTC slices', () => {
    const suggestion = selectCompanionSuggestion(base({ dateKey: TODAY, todayKey: TODAY }));
    expect(suggestion?.cta.params?.date).toBe(TODAY);
  });
});
