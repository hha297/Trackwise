import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { getReminderCopy } from './content';
import { navigateForReminder, parseReminderDeepLink } from './navigation';
import {
  getNotificationPermission,
  requestNotificationPermission,
} from './permissions';
import {
  loadReminderPreferences,
  saveReminderPreferences,
} from './preferences';
import { reconcileReminders } from './reconcile';
import { buildReminderPlan } from './schedule-plan';
import {
  applyReminderPlan,
  cancelTrackwiseReminders,
  configureNotificationHandler,
  ensureAndroidReminderChannel,
} from './scheduler';
import type { PermissionSnapshot, ReminderPreferences } from './types';

let scheduleTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSchedulePrefs: ReminderPreferences | null = null;

function anyReminderEnabled(prefs: ReminderPreferences): boolean {
  return (
    prefs.workout.enabled ||
    prefs.meals.breakfast.enabled ||
    prefs.meals.lunch.enabled ||
    prefs.meals.dinner.enabled ||
    prefs.hydration.enabled
  );
}

async function flushSchedule(prefs: ReminderPreferences): Promise<void> {
  await ensureAndroidReminderChannel();
  if (!anyReminderEnabled(prefs)) {
    await cancelTrackwiseReminders();
    return;
  }
  const permission = await getNotificationPermission();
  if (!permission.canNotify) {
    await cancelTrackwiseReminders();
    return;
  }
  const plan = buildReminderPlan(prefs, getReminderCopy());
  await applyReminderPlan(plan);
}

/** Debounce native cancel/reschedule so rapid toggles stay snappy. */
function queueSchedule(prefs: ReminderPreferences): void {
  pendingSchedulePrefs = prefs;
  if (scheduleTimer) clearTimeout(scheduleTimer);
  scheduleTimer = setTimeout(() => {
    const next = pendingSchedulePrefs;
    pendingSchedulePrefs = null;
    scheduleTimer = null;
    if (!next) return;
    void flushSchedule(next).catch(() => {
      // Soft-fail — next reconcile / toggle will retry.
    });
  }, 280);
}

export async function updateReminderPreferences(
  next: ReminderPreferences,
): Promise<{
  prefs: ReminderPreferences;
  permission: PermissionSnapshot;
  scheduled: boolean;
  permissionBlocked: boolean;
}> {
  configureNotificationHandler();
  // Persist first — cheap; UI already updated optimistically.
  const prefs = await saveReminderPreferences(next);

  let permission = await getNotificationPermission();

  if (
    anyReminderEnabled(prefs) &&
    !permission.canNotify &&
    (permission.status === 'undetermined' || permission.canAskAgain)
  ) {
    // Channel before prompt (Android 13+); only on the rare first-enable path.
    await ensureAndroidReminderChannel();
    permission = await requestNotificationPermission();
    permission = await getNotificationPermission();
  }

  // Native cancel/reschedule is debounced — do not block the switch animation.
  queueSchedule(prefs);

  if (!anyReminderEnabled(prefs)) {
    return { prefs, permission, scheduled: false, permissionBlocked: false };
  }
  if (!permission.canNotify) {
    return { prefs, permission, scheduled: false, permissionBlocked: true };
  }
  return { prefs, permission, scheduled: true, permissionBlocked: false };
}

export async function openSystemNotificationSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('app-settings:');
    return;
  }
  if (Platform.OS === 'android') {
    await Linking.openSettings();
  }
}

export function attachNotificationResponseListener(): () => void {
  if (Platform.OS === 'web') return () => undefined;

  configureNotificationHandler();

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const link = parseReminderDeepLink(response.notification.request.content.data);
    if (link) navigateForReminder(link);
  });

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    const link = parseReminderDeepLink(response.notification.request.content.data);
    if (link) navigateForReminder(link);
  });

  return () => {
    sub.remove();
  };
}

export { loadReminderPreferences, reconcileReminders, getNotificationPermission };
