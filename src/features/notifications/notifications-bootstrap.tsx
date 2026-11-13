import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import i18n from '@/i18n';
import { reportError } from '@/lib/errors/report-error';

import { attachNotificationResponseListener, reconcileReminders } from './service';

/**
 * Mount once under the root navigator after fonts/bootstrap are ready.
 * Local reminders only — no push token registration.
 */
export function NotificationsBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const detach = attachNotificationResponseListener();

    void reconcileReminders().catch((err: unknown) => {
      reportError(err, { area: 'notifications', action: 'startup-reconcile' });
    });

    const onAppState = (state: string) => {
      if (state !== 'active') return;
      void reconcileReminders().catch((err: unknown) => {
        reportError(err, { area: 'notifications', action: 'foreground-reconcile' });
      });
    };
    const appSub = AppState.addEventListener('change', onAppState);

    const onLanguage = () => {
      void reconcileReminders().catch((err: unknown) => {
        reportError(err, { area: 'notifications', action: 'language-reconcile' });
      });
    };
    i18n.on('languageChanged', onLanguage);

    return () => {
      detach();
      appSub.remove();
      i18n.off('languageChanged', onLanguage);
    };
  }, []);

  return null;
}
