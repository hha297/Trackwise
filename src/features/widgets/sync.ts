import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { reportError } from '@/lib/errors/report-error';

import { buildDailyWidgetSnapshot } from './daily-snapshot';
import {
  DAILY_WIDGET_NAME,
  WORKOUT_WIDGET_NAME,
  type DailyWidgetProps,
  type WidgetColorScheme,
  type WorkoutWidgetProps,
} from './models';
import { buildWorkoutWidgetSnapshot } from './workout-snapshot';

type NativeWidget = {
  updateSnapshot: (props: DailyWidgetProps | WorkoutWidgetProps) => void;
};

type ExpoWidgetsModule = {
  Widget: new (name: string, layout: string, initialProps: object | null) => NativeWidget;
};

const widgetHandles: Partial<Record<string, NativeWidget>> = {};

function expoWidgets(): ExpoWidgetsModule | null {
  return requireOptionalNativeModule<ExpoWidgetsModule>('ExpoWidgets');
}

/** Home-screen widgets need the ExpoWidgets native module (dev/store build, not Expo Go). */
export function homeScreenWidgetsAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return expoWidgets()?.Widget != null;
}

/**
 * Push props into the native widget without loading `widgets/*.tsx` through Metro.
 * Android Glance already has the layout in the APK registry; constructing Widget with an
 * empty layout leaves that embedded layout in place (`takeIf { it.isNotEmpty() }`).
 */
function nativeWidget(name: string): NativeWidget | null {
  if (widgetHandles[name]) return widgetHandles[name] ?? null;
  const Widget = expoWidgets()?.Widget;
  if (!Widget) return null;
  const handle = new Widget(name, '', null);
  widgetHandles[name] = handle;
  return handle;
}

export async function applyHomeScreenWidgetSnapshots(input: {
  daily: DailyWidgetProps;
  workout: WorkoutWidgetProps;
}): Promise<void> {
  if (!homeScreenWidgetsAvailable()) return;
  try {
    nativeWidget(DAILY_WIDGET_NAME)?.updateSnapshot(input.daily);
    nativeWidget(WORKOUT_WIDGET_NAME)?.updateSnapshot(input.workout);
  } catch (error) {
    reportError(error, { area: 'widgets', action: 'update-snapshot' });
  }
}

export async function clearHomeScreenWidgets(colorScheme?: WidgetColorScheme): Promise<void> {
  await applyHomeScreenWidgetSnapshots({
    daily: buildDailyWidgetSnapshot({ signedIn: false, colorScheme }),
    workout: buildWorkoutWidgetSnapshot({ signedIn: false, colorScheme }),
  });
}
