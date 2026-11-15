import { getReminderCopy } from './content';
import { getNotificationPermission } from './permissions';
import { loadReminderPreferences } from './preferences';
import { buildReminderPlan } from './schedule-plan';
import {
  applyReminderPlan,
  cancelTrackwiseReminders,
  configureNotificationHandler,
  ensureAndroidReminderChannel,
  type ApplyPlanResult,
} from './scheduler';
import type { PermissionSnapshot, ReminderPreferences } from './types';

export type ReconcileResult = {
  prefs: ReminderPreferences;
  permission: PermissionSnapshot;
  apply: ApplyPlanResult | null;
};

let reconcileInFlight: Promise<ReconcileResult> | null = null;

/**
 * Load prefs + permission, then make scheduled notifications match.
 * Safe to call on startup, foreground, language change, and after preference edits.
 */
export async function reconcileReminders(): Promise<ReconcileResult> {
  if (reconcileInFlight) return reconcileInFlight;

  reconcileInFlight = (async () => {
    configureNotificationHandler();
    await ensureAndroidReminderChannel();
    const prefs = await loadReminderPreferences();
    const permission = await getNotificationPermission();

    if (!permission.canNotify) {
      await cancelTrackwiseReminders();
      return {
        prefs,
        permission,
        apply: { cancelled: [], scheduled: [], failed: [] },
      };
    }

    const plan = buildReminderPlan(prefs, getReminderCopy());
    const apply = await applyReminderPlan(plan);
    return { prefs, permission, apply };
  })();

  try {
    return await reconcileInFlight;
  } finally {
    reconcileInFlight = null;
  }
}
