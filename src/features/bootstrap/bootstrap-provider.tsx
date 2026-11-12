import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { isEmailConfirmed } from '@/features/auth/email-confirmed';
import { fetchProfile } from '@/features/goals/api';
import { getOnboardingCompleted, setOnboardingCompleted } from '@/features/onboarding/storage';
import i18n from '@/i18n';
import { reportError } from '@/lib/errors/report-error';
import { queryClient } from '@/lib/query/query-client';

import {
  extractErrorMessage,
  isAuthFailure,
  prefetchBootstrapData,
  toBootstrapErrorMessage,
} from './prefetch';

export type AppDestination =
  | 'onboarding'
  | 'auth'
  | 'verify-email'
  | 'setup'
  | 'main'
  | 'update-password';

type BootstrapContextValue = {
  /** True while restoring session / reading onboarding / prefetching required Main data. */
  isBootstrapping: boolean;
  destination: AppDestination | null;
  error: string | null;
  retry: () => void;
  /** Clears the stale session and returns the user to auth. */
  recoverToAuth: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const { isReady, session, passwordRecovery, signOut } = useAuth();
  const [welcomeDone, setWelcomeDone] = useState<boolean | null>(null);
  const emailVerified = isEmailConfirmed(session?.user);
  /** Prefetch only for verified users who are not mid password-recovery. */
  const userId = passwordRecovery || !emailVerified ? undefined : session?.user.id;
  const email = session?.user.email;

  useEffect(() => {
    let active = true;
    getOnboardingCompleted()
      .then((value) => {
        if (active) {
          setWelcomeDone(value);
        }
      })
      .catch((err: unknown) => {
        reportError(err, { area: 'onboarding', action: 'read-flag' });
        if (active) {
          setWelcomeDone(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const recoverToAuth = useCallback(async () => {
    try {
      await signOut();
    } catch (signOutError) {
      reportError(signOutError, { area: 'bootstrap', action: 'recover-to-auth' });
    } finally {
      queryClient.clear();
    }
  }, [signOut]);

  const bootstrapQuery = useQuery({
    queryKey: ['bootstrap', userId],
    enabled: Boolean(isReady && welcomeDone !== null && userId),
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (!userId) {
        return null;
      }

      try {
        await prefetchBootstrapData(queryClient, { userId, email });
        return userId;
      } catch (err) {
        const detail = extractErrorMessage(err) || 'Unknown error';
        reportError(err instanceof Error ? err : new Error(detail), {
          area: 'bootstrap',
          action: 'prefetch',
        });

        if (isAuthFailure(err)) {
          await recoverToAuth();
          return null;
        }

        throw new Error(toBootstrapErrorMessage(err));
      }
    },
  });

  const retry = useCallback(() => {
    void bootstrapQuery.refetch();
  }, [bootstrapQuery]);

  const completeOnboarding = useCallback(async () => {
    await setOnboardingCompleted();
    setWelcomeDone(true);
  }, []);

  const prefetchReady = Boolean(userId && bootstrapQuery.isSuccess && bootstrapQuery.data === userId);
  const prefetchError =
    userId && bootstrapQuery.isError && !bootstrapQuery.isFetching
      ? bootstrapQuery.error instanceof Error && bootstrapQuery.error.message
        ? bootstrapQuery.error.message
        : i18n.t('bootstrap.loadFailed')
      : null;

  // After auth-failure recovery, query succeeds with null until session clears.
  const awaitingSessionClear =
    Boolean(userId) && bootstrapQuery.isSuccess && bootstrapQuery.data === null;

  // Subscribe to profile — getQueryData is not reactive, so finishing setup
  // would leave destination stuck on 'setup' even after onboarding_completed_at is set.
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchProfile(userId!),
  });
  const setupComplete = Boolean(profileQuery.data?.onboarding_completed_at);

  const destination = useMemo((): AppDestination | null => {
    if (!isReady || welcomeDone === null) {
      return null;
    }

    if (passwordRecovery) {
      return 'update-password';
    }

    if (session) {
      if (!emailVerified) {
        return 'verify-email';
      }
      if (awaitingSessionClear) {
        return null;
      }
      if (!prefetchReady || prefetchError) {
        return null;
      }
      if (!setupComplete) {
        return 'setup';
      }
      return 'main';
    }

    return welcomeDone ? 'auth' : 'onboarding';
  }, [
    isReady,
    welcomeDone,
    passwordRecovery,
    session,
    emailVerified,
    awaitingSessionClear,
    prefetchReady,
    prefetchError,
    setupComplete,
  ]);

  const isBootstrapping =
    !isReady ||
    welcomeDone === null ||
    awaitingSessionClear ||
    (Boolean(userId) && !prefetchReady && !prefetchError);

  const value = useMemo(
    () => ({
      isBootstrapping,
      destination,
      error: prefetchError,
      retry,
      recoverToAuth,
      completeOnboarding,
    }),
    [isBootstrapping, destination, prefetchError, retry, recoverToAuth, completeOnboarding],
  );

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap(): BootstrapContextValue {
  const value = useContext(BootstrapContext);
  if (!value) {
    throw new Error('useBootstrap must be used within BootstrapProvider');
  }
  return value;
}
