import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateSnapshot = vi.fn();
const Widget = vi.fn(function Widget() {
  return { updateSnapshot };
});

vi.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => ({ Widget }),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('@/lib/errors/report-error', () => ({
  reportError: vi.fn(),
}));

vi.mock('./daily-snapshot', () => ({
  buildDailyWidgetSnapshot: vi.fn(),
}));

vi.mock('./workout-snapshot', () => ({
  buildWorkoutWidgetSnapshot: vi.fn(),
}));

import { applyHomeScreenWidgetSnapshots, homeScreenWidgetsAvailable } from './sync';
import { UNSIGNED_DAILY_WIDGET_PROPS, UNSIGNED_WORKOUT_WIDGET_PROPS } from './models';

describe('applyHomeScreenWidgetSnapshots', () => {
  beforeEach(() => {
    updateSnapshot.mockClear();
    Widget.mockClear();
  });

  it('is available on Android when ExpoWidgets is present', () => {
    expect(homeScreenWidgetsAvailable()).toBe(true);
  });

  it('writes snapshots through the native module without a Metro widget layout', async () => {
    await applyHomeScreenWidgetSnapshots({
      daily: UNSIGNED_DAILY_WIDGET_PROPS,
      workout: UNSIGNED_WORKOUT_WIDGET_PROPS,
    });
    expect(Widget).toHaveBeenCalledWith('TrackwiseDaily', '', null);
    expect(Widget).toHaveBeenCalledWith('TrackwiseWorkout', '', null);
    expect(updateSnapshot).toHaveBeenCalledWith(UNSIGNED_DAILY_WIDGET_PROPS);
    expect(updateSnapshot).toHaveBeenCalledWith(UNSIGNED_WORKOUT_WIDGET_PROPS);
  });
});
