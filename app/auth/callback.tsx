import * as Linking from 'expo-linking';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { LoadingState } from '@/components/ui/states';
import { useAuth } from '@/features/auth/auth-provider';
import { reportError } from '@/lib/errors/report-error';

/**
 * Landing route for Supabase redirects. This screen and global listeners use the
 * same deduplicated AuthProvider handler, including on a cold start.
 */
export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const url = Linking.useURL();
  const { session, passwordRecovery, isReady, handleAuthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (!url || handled) {
      return;
    }

    let active = true;
    void (async () => {
      try {
        await handleAuthCallback(url);
      } catch (err) {
        reportError(err, { area: 'auth', action: 'callback-screen' });
        if (active) {
          setError(err instanceof Error ? err.message : t('auth.callbackFailed'));
        }
      } finally {
        if (active) {
          setHandled(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [url, handled, handleAuthCallback, t]);

  if (error) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View className="flex-1 justify-center gap-4">
          <BrandMark />
          <Text variant="headingSmall">{t('auth.callbackLinkFailedTitle')}</Text>
          <Text variant="body" tone="secondary">
            {error}
          </Text>
          <Button
            label={t('auth.goToSignIn')}
            onPress={() => router.replace('/(auth)/sign-in')}
          />
        </View>
      </Screen>
    );
  }

  if (!isReady || (!handled && url)) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View className="flex-1 justify-center gap-6">
          <BrandMark />
          <LoadingState label={t('auth.finishingSignIn')} />
        </View>
      </Screen>
    );
  }

  if (passwordRecovery) {
    return <Redirect href="/(auth)/update-password" />;
  }

  if (session) {
    return <Redirect href="/" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
