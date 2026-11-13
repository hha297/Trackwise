import { router } from 'expo-router';

import { parseReminderDeepLink } from './deep-link';
import type { MealReminderKind, ReminderDeepLink } from './types';

export { parseReminderDeepLink };

/** Navigate to existing screens — never creates new tabs. */
export function navigateForReminder(link: ReminderDeepLink): void {
  try {
    if (link.kind === 'workout') {
      router.push('/(tabs)/workout');
      return;
    }
    if (link.kind === 'hydration') {
      router.push('/');
      return;
    }
    if (link.kind === 'meal') {
      router.push({
        pathname: '/food/add',
        params: { meal: mealParam(link.meal) },
      });
    }
  } catch {
    // App may still be bootstrapping — ignore; user can navigate manually.
  }
}

function mealParam(meal: MealReminderKind): string {
  return meal;
}
