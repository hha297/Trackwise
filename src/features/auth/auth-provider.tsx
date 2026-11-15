import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { analytics } from '@/lib/analytics/analytics';
import { reportError } from '@/lib/errors/report-error';
import { queryClient } from '@/lib/query/query-client';
import { getSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { useActiveWorkoutStore } from '@/stores/active-workout-store';

import { collectOAuthCallbackUrl } from './await-oauth-callback';
import { isEmailConfirmed } from './email-confirmed';
import {
  assertUsableAuthRedirectUri,
  getAuthRedirectUri,
  getRedirectToFromAuthorizeUrl,
  isExpoGoRuntime,
} from './redirect';
import { getRememberMe, setRememberMe } from './remember-me';
import {
  createSessionFromUrl,
  isAuthCallbackUrl,
  type SessionFromUrlResult,
} from './session-from-url';

WebBrowser.maybeCompleteAuthSession();

type SignUpResult = {
  /** True when the user must enter the signup email OTP before continuing. */
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  isConfigured: boolean;
  isReady: boolean;
  session: Session | null;
  passwordRecovery: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signInWithGoogle: () => Promise<'success' | 'cancelled'>;
  handleAuthCallback: (url: string | null) => Promise<SessionFromUrlResult | null>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  /** Resends the signup confirmation email (OTP when Confirm signup template uses {{ .Token }}). */
  resendConfirmationEmail: (email: string) => Promise<void>;
  /** Verifies the signup email OTP (`type: 'signup'`). */
  verifySignupOtp: (email: string, token: string) => Promise<void>;
  /** Sends a recovery email (OTP when the Reset Password template uses {{ .Token }}). */
  resetPasswordForEmail: (email: string) => Promise<void>;
  /** Verifies the recovery OTP and marks the session as password-recovery. */
  verifyRecoveryOtp: (email: string, token: string) => Promise<void>;
  /**
   * Sets a new password during recovery, then signs out so the user can
   * sign in fresh. Keeps passwordRecovery true until sign-out completes.
   */
  completePasswordReset: (password: string) => Promise<void>;
  clearPasswordRecovery: () => void;
  /** Change password while signed in (email/password accounts). */
  changePassword: (newPassword: string) => Promise<void>;
  /** Request email change (Supabase sends confirmation to the new address). */
  updateEmail: (newEmail: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function clearUserLocalState() {
  queryClient.clear();
  useActiveWorkoutStore.getState().reset();
  void import('@/features/widgets/sync').then((mod) => mod.clearHomeScreenWidgets());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(!configured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const callbackResults = useRef(new Map<string, Promise<SessionFromUrlResult>>());
  const googleSignInInFlight = useRef<Promise<'success' | 'cancelled'> | null>(null);
  /** True while verifyOtp(recovery) is in flight — blocks dashboard routing on SIGNED_IN. */
  const recoveryOtpInFlight = useRef(false);

  const handleAuthCallback = useCallback(async (url: string | null) => {
    if (!isAuthCallbackUrl(url)) return null;

    const existing = callbackResults.current.get(url);
    if (existing) return existing;

    // Email confirm / OAuth callbacks only — password reset uses in-app OTP.
    const callback = (async () => {
      await setRememberMe(true);
      const result = await createSessionFromUrl(url);
      if (result.isPasswordRecovery) setPasswordRecovery(true);
      return result;
    })();

    callbackResults.current.set(url, callback);
    try {
      return await callback;
    } catch (error) {
      callbackResults.current.delete(url);
      throw error;
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    if (!supabase) {
      return;
    }

    let active = true;

    void (async () => {
      try {
        const remember = await getRememberMe();
        const initialUrl = await Linking.getInitialURL();
        const fromAuthLink = isAuthCallbackUrl(initialUrl);

        const { data, error } = await supabase.auth.getSession();
        if (!active) {
          return;
        }
        if (error) {
          reportError(error, { area: 'auth', action: 'restore-session' });
        }

        // Ephemeral sign-in: drop persisted session on cold start, unless this
        // launch is finishing an email confirm deep link.
        if (!remember && data.session && !fromAuthLink) {
          await supabase.auth.signOut({ scope: 'local' });
          clearUserLocalState();
          if (active) {
            setSession(null);
            setIsReady(true);
          }
          return;
        }

        setSession(data.session);
        setIsReady(true);
      } catch (error: unknown) {
        if (!active) {
          return;
        }
        reportError(error, { area: 'auth', action: 'restore-session' });
        setIsReady(true);
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);

      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && recoveryOtpInFlight.current)) {
        setPasswordRecovery(true);
      }

      if (event === 'SIGNED_IN' && next?.user.id && !recoveryOtpInFlight.current) {
        analytics.identify(next.user.id);
      }

      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
        analytics.reset();
      }
    });

    void Linking.getInitialURL().then((url) => {
      void handleAuthCallback(url).catch((error: unknown) => {
        reportError(error, { area: 'auth', action: 'initial-deep-link' });
      });
    });

    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      void handleAuthCallback(url).catch((error: unknown) => {
        reportError(error, { area: 'auth', action: 'deep-link' });
      });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
      linkingSub.remove();
    };
  }, [handleAuthCallback]);

  const signIn = useCallback(async (email: string, password: string, rememberMe = true) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }

    await setRememberMe(rememberMe);
    analytics.track('auth_sign_in_succeeded');
  }, []);

  const signInWithGoogle = useCallback(() => {
    if (googleSignInInFlight.current) return googleSignInInFlight.current;

    const request = (async (): Promise<'success' | 'cancelled'> => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase is not configured.');

      const redirectTo = getAuthRedirectUri();
      assertUsableAuthRedirectUri(redirectTo);

      if (isExpoGoRuntime() && redirectTo.startsWith('trackwise:')) {
        reportError(new Error('Expo Go OAuth missing Metro exp:// redirect'), {
          area: 'auth',
          action: 'google-oauth-redirect',
          redirectTo,
        });
        throw new Error('Google sign-in could not be started.');
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: 'openid email profile',
        },
      });
      if (error) {
        reportError(error, {
          area: 'auth',
          action: 'google-oauth-start',
          redirectTo,
        });
        throw error;
      }
      if (!data.url) {
        throw new Error('Google sign-in could not be started.');
      }

      const authorizeRedirectTo = getRedirectToFromAuthorizeUrl(data.url);
      if (authorizeRedirectTo !== redirectTo) {
        reportError(new Error('Supabase authorize redirect_to mismatch'), {
          area: 'auth',
          action: 'google-oauth-redirect-mismatch',
          redirectTo,
          authorizeRedirectTo: authorizeRedirectTo ?? 'missing',
        });
        throw new Error('Google sign-in could not be started.');
      }

      const collected = await collectOAuthCallbackUrl({
        authUrl: data.url,
        redirectTo,
      });

      const callbackUrl = collected.url;

      // Global Linking listener may already have exchanged the session.
      if (!callbackUrl) {
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session) {
          analytics.track('auth_google_sign_in_succeeded');
          return 'success';
        }
        if (collected.reason === 'timeout') {
          reportError(new Error('Google OAuth timed out waiting for callback'), {
            area: 'auth',
            action: 'google-oauth-timeout',
            browserType: collected.browserType,
          });
        }
        return 'cancelled';
      }

      const result = await handleAuthCallback(callbackUrl);
      if (!result?.session) {
        throw new Error('Google sign-in did not create a session.');
      }

      analytics.track('auth_google_sign_in_succeeded');
      return 'success';
    })();

    googleSignInInFlight.current = request;
    void request.finally(() => {
      googleSignInInFlight.current = null;
    });
    return request;
  }, [handleAuthCallback]);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    // No emailRedirectTo — confirmation uses in-app OTP ({{ .Token }} in the email template).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      throw error;
    }

    await setRememberMe(true);

    const identityCount = data.user?.identities?.length ?? 0;
    if (!data.user || identityCount === 0) {
      throw new Error('An account with that email already exists. Sign in instead.');
    }

    if (isEmailConfirmed(data.user) && data.session) {
      analytics.track('auth_sign_up_succeeded');
      return { needsEmailConfirmation: false };
    }

    analytics.track('auth_sign_up_confirmation_required');
    return { needsEmailConfirmation: true };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.auth.signOut();
    clearUserLocalState();
    setPasswordRecovery(false);

    if (error) {
      throw error;
    }

    analytics.track('auth_sign_out_succeeded');
  }, []);

  const resendConfirmationEmail = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    // No redirectTo — signup confirmation uses in-app OTP.
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) {
      throw error;
    }

    analytics.track('auth_confirmation_resent');
  }, []);

  const verifySignupOtp = useCallback(async (email: string, token: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    if (error) {
      throw error;
    }

    const confirmedUser = data.user ?? data.session?.user ?? null;
    if (!isEmailConfirmed(confirmedUser)) {
      const { data: fresh, error: userError } = await supabase.auth.getUser();
      if (userError) {
        throw userError;
      }
      if (!isEmailConfirmed(fresh.user)) {
        throw new Error('Email verification did not complete.');
      }
    }

    await setRememberMe(true);
    analytics.track('auth_signup_otp_verified');
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    // No redirectTo — recovery uses in-app OTP ({{ .Token }} in the email template).
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      throw error;
    }

    analytics.track('auth_password_reset_requested');
  }, []);

  const verifyRecoveryOtp = useCallback(async (email: string, token: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    recoveryOtpInFlight.current = true;
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery',
      });
      if (error) {
        throw error;
      }
      // Keep recovery lock for update-password; do not navigate to Main.
      setPasswordRecovery(true);
      analytics.track('auth_recovery_otp_verified');
    } finally {
      recoveryOtpInFlight.current = false;
    }
  }, []);

  const completePasswordReset = useCallback(async (password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      throw updateError;
    }

    analytics.track('auth_password_updated');

    // Stay in recovery until sign-out finishes so guards never send the user to Main.
    const { error: signOutError } = await supabase.auth.signOut();
    clearUserLocalState();
    setPasswordRecovery(false);

    if (signOutError) {
      throw signOutError;
    }
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    analytics.track('auth_password_changed');
  }, []);

  const updateEmail = useCallback(async (newEmail: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) throw error;
    analytics.track('auth_email_change_requested');
  }, []);

  const value = useMemo(
    () => ({
      isConfigured: configured,
      isReady,
      session,
      passwordRecovery,
      signIn,
      signInWithGoogle,
      handleAuthCallback,
      signUp,
      signOut,
      resendConfirmationEmail,
      verifySignupOtp,
      resetPasswordForEmail,
      verifyRecoveryOtp,
      completePasswordReset,
      clearPasswordRecovery,
      changePassword,
      updateEmail,
    }),
    [
      configured,
      isReady,
      session,
      passwordRecovery,
      signIn,
      signInWithGoogle,
      handleAuthCallback,
      signUp,
      signOut,
      resendConfirmationEmail,
      verifySignupOtp,
      resetPasswordForEmail,
      verifyRecoveryOtp,
      completePasswordReset,
      clearPasswordRecovery,
      changePassword,
      updateEmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
