import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { fullReplaceTargets, isTrackwiseReminderId } from './schedule-plan';
import type { PlannedReminder } from './types';
import { ANDROID_CHANNEL_ID } from './types';

let handlerConfigured = false;
let androidChannelReady = false;

export function configureNotificationHandler(): void {
  if (handlerConfigured || Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerConfigured = true;
}

/**
 * Create the Android reminders channel (needed before the OS permission prompt on 13+).
 * Keep the payload minimal — vibrationPattern/lightColor have caused native NPEs in
 * some Expo Go / RN builds when serialized across the bridge.
 */
export async function ensureAndroidReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      // AndroidImportance.DEFAULT — avoid optional native fields that NPE on some builds.
      importance: 5,
    });
    androidChannelReady = true;
  } catch {
    // Soft-fail: reconcile/scheduling must not crash the app if channel setup fails.
  }
}

export async function listScheduledTrackwiseIds(): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((item) => item.identifier).filter(isTrackwiseReminderId);
}

export async function cancelTrackwiseReminders(ids?: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  if (ids) {
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    return;
  }
  const owned = await listScheduledTrackwiseIds();
  await Promise.all(owned.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

async function scheduleOne(reminder: PlannedReminder): Promise<void> {
  const channelId = Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined;
  const trigger: Notifications.NotificationTriggerInput =
    reminder.expoWeekday == null
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: reminder.hour,
          minute: reminder.minute,
          ...(channelId ? { channelId } : null),
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: reminder.expoWeekday,
          hour: reminder.hour,
          minute: reminder.minute,
          ...(channelId ? { channelId } : null),
        };

  await Notifications.scheduleNotificationAsync({
    identifier: reminder.identifier,
    content: {
      title: reminder.title,
      body: reminder.body,
      data: reminder.data,
      sound: true,
      ...(channelId ? { channelId } : null),
    },
    trigger,
  });
}

export type ApplyPlanResult = {
  cancelled: string[];
  scheduled: string[];
  failed: { identifier: string; error: string }[];
};

/**
 * Replace all Trackwise-owned schedules with `desired`.
 * Idempotent when called repeatedly with the same plan (cancel then re-create).
 */
export async function applyReminderPlan(desired: PlannedReminder[]): Promise<ApplyPlanResult> {
  if (Platform.OS === 'web') {
    return { cancelled: [], scheduled: [], failed: [] };
  }

  await ensureAndroidReminderChannel();
  const scheduledIds = await listScheduledTrackwiseIds();
  const { toCancel, toSchedule } = fullReplaceTargets(desired, scheduledIds);

  const cancelled: string[] = [];
  for (const id of toCancel) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      cancelled.push(id);
    } catch {
      // Continue — missing IDs are fine during recovery.
    }
  }

  const scheduled: string[] = [];
  const failed: ApplyPlanResult['failed'] = [];
  for (const item of toSchedule) {
    try {
      await scheduleOne(item);
      scheduled.push(item.identifier);
    } catch (error) {
      failed.push({
        identifier: item.identifier,
        error: error instanceof Error ? error.message : 'schedule_failed',
      });
    }
  }

  return { cancelled, scheduled, failed };
}
