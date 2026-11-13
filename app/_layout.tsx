import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { type ReactNode, useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import '../global.css';

import '@/i18n';

import { AuthProvider } from '@/features/auth/auth-provider';
import {
  BootstrapProvider,
  useBootstrap,
  type AppDestination,
} from '@/features/bootstrap/bootstrap-provider';
import { BootstrapScreen } from '@/features/bootstrap/bootstrap-screen';
import { NotificationsBootstrap } from '@/features/notifications/notifications-bootstrap';
import { reportError } from '@/lib/errors/report-error';
import { queryClient } from '@/lib/query/query-client';
import { useAppFonts } from '@/theme/fonts';
import { ThemeProvider, useTheme, useThemeColors } from '@/theme/theme-provider';

function isAuthPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes('sign-in') ||
    pathname.includes('sign-up') ||
    pathname.includes('forgot-password') ||
    pathname.includes('check-email') ||
    pathname.includes('verify-email') ||
    pathname.includes('reset-password') ||
    pathname.includes('update-password') ||
    pathname.includes('verify-recovery') ||
    pathname.includes('auth/callback')
  );
}

/**
 * When Stack.Protected flips main → auth (logout / session clear), the URL can
 * remain on a main-only path and Expo Router shows Unmatched Route (`trackwise:///`).
 * Move onto an auth screen that is actually mounted.
 */
function AuthDestinationSync({ destination }: { destination: AppDestination }) {
  const pathname = usePathname();

  useEffect(() => {
    if (destination === 'auth' && !isAuthPath(pathname)) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (
      destination === 'update-password' &&
      !pathname.includes('reset-password') &&
      !pathname.includes('update-password')
    ) {
      router.replace('/(auth)/reset-password');
      return;
    }
    if (destination === 'verify-email' && !pathname.includes('verify-email')) {
      router.replace('/(auth)/verify-email');
    }
  }, [destination, pathname]);

  return null;
}

SplashScreen.preventAutoHideAsync();

function RootShell({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  return <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>;
}

export default function RootLayout() {
  const fontsLoaded = useAppFonts();

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <RootShell>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <BootstrapProvider>
                <RootNavigator />
              </BootstrapProvider>
            </AuthProvider>
          </QueryClientProvider>
        </RootShell>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { isBootstrapping, destination, error, retry, recoverToAuth } = useBootstrap();
  const { scheme, colors } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch((err: unknown) => {
      reportError(err, { area: 'system-ui' });
    });
  }, [colors.background, scheme]);

  // Keep the native splash up through session restore / prefetch so we don't flash a
  // second oversized branded loading screen. Reveal once we have a destination or error.
  const revealApp = Boolean(error) || Boolean(destination && !isBootstrapping);

  useEffect(() => {
    if (!revealApp) return;
    SplashScreen.hideAsync().catch((err: unknown) => {
      reportError(err, { area: 'splash' });
    });
  }, [revealApp]);

  const bootstrapStatus = scheme === 'dark' ? 'light' : 'dark';

  if (error) {
    return (
      <>
        <StatusBar style={bootstrapStatus} />
        <BootstrapScreen
          error={error}
          onRetry={retry}
          onSignIn={() => {
            void recoverToAuth();
          }}
        />
      </>
    );
  }

  if (isBootstrapping || !destination) {
    // Native splash remains visible (preventAutoHideAsync). Fallback UI only if
    // splash was already dismissed (e.g. hot reload).
    return (
      <>
        <StatusBar style={bootstrapStatus} />
        <BootstrapScreen />
      </>
    );
  }

  const showOnboarding = destination === 'onboarding';
  const showSetup = destination === 'setup';
  const showMain = destination === 'main';
  const showAuth =
    destination === 'auth' || destination === 'update-password' || destination === 'verify-email';
  const statusStyle = showAuth || showMain ? (scheme === 'dark' ? 'light' : 'dark') : 'light';

  return (
    <>
      <StatusBar style={statusStyle} />
      {showMain ? <NotificationsBootstrap /> : null}
      {showAuth ? <AuthDestinationSync destination={destination} /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={showOnboarding}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        <Stack.Protected guard={showSetup}>
          <Stack.Screen name="(setup)" />
        </Stack.Protected>

        <Stack.Protected guard={showMain}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="diary" />
          <Stack.Screen name="food" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="workout"
            options={{
              animation: Platform.OS === 'ios' ? 'default' : 'ios_from_right',
              // iOS keeps native edge-swipe. Android uses AndroidEdgeSwipeBack
              // inside the workout layout (Expo Router disables native swipe there).
              gestureEnabled: true,
              animationMatchesGesture: true,
              contentStyle: { backgroundColor: colors.background },
              freezeOnBlur: false,
            }}
          />
          <Stack.Screen name="goals" options={{ presentation: 'modal' }} />
          <Stack.Screen name="measurements" options={{ presentation: 'modal' }} />
          <Stack.Screen name="account" options={{ presentation: 'modal' }} />
        </Stack.Protected>

        <Stack.Protected guard={showAuth}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
      </Stack>
    </>
  );
}
