import i18n from '@/i18n';

import type { ReminderCopy } from './schedule-plan';

/** Localized notification copy for the current app language. */
export function getReminderCopy(t: typeof i18n.t = i18n.t.bind(i18n)): ReminderCopy {
  return {
    workout: {
      title: t('notifications.push.workoutTitle'),
      body: t('notifications.push.workoutBody'),
    },
    meals: {
      breakfast: {
        title: t('notifications.push.breakfastTitle'),
        body: t('notifications.push.breakfastBody'),
      },
      lunch: {
        title: t('notifications.push.lunchTitle'),
        body: t('notifications.push.lunchBody'),
      },
      dinner: {
        title: t('notifications.push.dinnerTitle'),
        body: t('notifications.push.dinnerBody'),
      },
    },
    hydration: {
      title: t('notifications.push.hydrationTitle'),
      body: t('notifications.push.hydrationBody'),
    },
  };
}
