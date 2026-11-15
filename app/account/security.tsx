import { KeyRound, Mail } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { SettingsRow, SettingsSection } from '@/features/account/settings-row';
import { toAuthErrorMessage } from '@/features/auth/auth-errors';
import { useAuth } from '@/features/auth/auth-provider';
import { PasswordRequirements } from '@/features/auth/password-requirements';
import { passwordMeetsRequirements } from '@/features/auth/password-rules';
import { reportError } from '@/lib/errors/report-error';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

function accountHasPassword(user: {
  identities?: { provider: string }[] | undefined;
  app_metadata?: Record<string, unknown>;
} | null): boolean {
  if (!user) return false;
  if (user.identities?.some((identity) => identity.provider === 'email')) {
    return true;
  }
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.includes('email')) {
    return true;
  }
  return false;
}

export default function SecurityScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { session, changePassword } = useAuth();

  const hasPassword = useMemo(() => accountHasPassword(session?.user ?? null), [session?.user]);

  const providers = useMemo(() => {
    const list = session?.user.identities?.map((i) => i.provider) ?? [];
    return list.length ? Array.from(new Set(list)).join(', ') : '—';
  }, [session?.user.identities]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function onChangePassword() {
    setPasswordError(null);
    setPasswordMessage(null);
    if (!passwordMeetsRequirements(newPassword)) {
      setPasswordError(t('auth.errors.passwordRequirements'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('account.passwordMismatch'));
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(t('account.saved'));
    } catch (err) {
      reportError(err, { area: 'account', action: 'change-password' });
      setPasswordError(toAuthErrorMessage(err));
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <HeaderDoneButton />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.accountSecurity')}
          </Text>
        </View>

        <SettingsSection>
          <SettingsRow
            icon={Mail}
            title={session?.user.email ?? '—'}
            subtitle={
              session?.user.email_confirmed_at
                ? t('account.emailVerified')
                : t('account.emailUnverified')
            }
            showChevron={false}
          />
          <SettingsRow
            icon={KeyRound}
            title={t('account.signInMethods')}
            subtitle={providers}
            showChevron={false}
          />
        </SettingsSection>

        {hasPassword ? (
          <View
            style={{
              gap: spacing[3],
              padding: spacing[4],
              borderRadius: radii.md,
              backgroundColor: colors.surface,
            }}
          >
            <Text variant="headingSmall">{t('account.changePassword')}</Text>
            <Text variant="caption" tone="muted">
              {t('account.currentPasswordHint')}
            </Text>
            <Input
              label={t('account.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <PasswordRequirements password={newPassword} interactive={newPassword.length > 0} />
            <Input
              label={t('account.confirmNewPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            {passwordError ? (
              <Text variant="bodySmall" tone="error">
                {passwordError}
              </Text>
            ) : null}
            {passwordMessage ? (
              <Text variant="bodySmall" tone="success">
                {passwordMessage}
              </Text>
            ) : null}
            <Button
              label={t('account.changePassword')}
              loading={passwordBusy}
              disabled={passwordBusy}
              onPress={() => void onChangePassword()}
            />
          </View>
        ) : (
          <View
            style={{
              padding: spacing[4],
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text variant="body" tone="secondary">
              {t('account.passwordUnavailable')}
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
