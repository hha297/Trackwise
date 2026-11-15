import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => import('./widget-i18n.mock'));

import { buildWorkoutWidgetSnapshot } from './workout-snapshot';

describe('buildWorkoutWidgetSnapshot', () => {

  it('hides workout names after sign-out', () => {
    const snap = buildWorkoutWidgetSnapshot({
      signedIn: false,
      workouts: [
        {
          id: 'w1',
          name: 'Secret session',
          started_at: '2026-11-15T08:00:00.000Z',
          ended_at: '2026-11-15T09:00:00.000Z',
          estimated_calories: 400,
          status: 'completed',
          active_duration_sec: 3600,
        },
      ],
    });
    expect(snap.signedIn).toBe(false);
    expect(snap.colorScheme).toBe('light');
    expect(snap.headline).not.toBe('Secret session');
  });

  it('prefers a completed session name and duration', () => {
    const snap = buildWorkoutWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      workouts: [
        {
          id: 'w1',
          name: 'Push day',
          started_at: '2026-11-15T08:00:00.000Z',
          ended_at: '2026-11-15T09:10:00.000Z',
          estimated_calories: 400,
          status: 'completed',
          active_duration_sec: 3600,
        },
      ],
    });
    expect(snap.hasSession).toBe(true);
    expect(snap.completed).toBe(true);
    expect(snap.colorScheme).toBe('light');
    expect(snap.headline).toBe('Push day');
    expect(snap.detail).toContain('60');
  });

  it('shows a rest day when that is what is scheduled', () => {
    const snap = buildWorkoutWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      plans: [
        {
          id: 'p1',
          planDate: '2026-11-15',
          kind: 'rest',
          templateId: null,
          title: null,
          completedWorkoutId: null,
        },
      ],
    });
    expect(snap.hasSession).toBe(true);
    expect(snap.headline.toLowerCase()).toContain('rest');
  });

  it('shows a scheduled plan name and opens the planner', () => {
    const snap = buildWorkoutWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      plans: [
        {
          id: 'p1',
          planDate: '2026-11-15',
          kind: 'workout',
          templateId: 't1',
          title: 'Pull day',
          completedWorkoutId: null,
        },
      ],
    });
    expect(snap.hasSession).toBe(true);
    expect(snap.completed).toBe(false);
    expect(snap.headline).toBe('Pull day');
    expect(snap.openUrl).toBe('trackwise:///workout/plan');
  });

  it('opens a completed session from the widget URL', () => {
    const snap = buildWorkoutWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      workouts: [
        {
          id: 'w9',
          name: 'Push day',
          started_at: '2026-11-15T08:00:00.000Z',
          ended_at: '2026-11-15T09:00:00.000Z',
          estimated_calories: 400,
          status: 'completed',
          active_duration_sec: 3600,
        },
      ],
    });
    expect(snap.openUrl).toBe('trackwise:///workout/w9');
  });

  it('forwards the app color scheme onto the snapshot', () => {
    const snap = buildWorkoutWidgetSnapshot({
      signedIn: true,
      colorScheme: 'dark',
      todayKey: '2026-11-15',
      plans: [],
      workouts: [],
    });
    expect(snap.colorScheme).toBe('dark');
  });

  it('uses an empty state when nothing is planned or completed', () => {
    const snap = buildWorkoutWidgetSnapshot({
      signedIn: true,
      todayKey: '2026-11-15',
      plans: [],
      workouts: [],
    });
    expect(snap.hasSession).toBe(false);
    expect(snap.hint.length).toBeGreaterThan(0);
  });
});
