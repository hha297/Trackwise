import { Link, router, type Href } from 'expo-router';
import {
  BookOpen,
  CircleHelp,
  Download,
  Eraser,
  FileText,
  Flag,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Bell,
  Moon,
  CalendarDays,
  Ruler,
  Scale,
  Shield,
  Sun,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, Text as RNText, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import {
  getPrivacyPolicyUrl,
  getTermsOfServiceUrl,
} from '@/features/account/constants';
import { useAdminDashboardEntry } from '@/features/account/hooks';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { SettingsRow, SettingsSection } from '@/features/account/settings-row';
import { toAuthErrorMessage } from '@/features/auth/auth-errors';
import { useAuth } from '@/features/auth/auth-provider';
import { ThemeToggle } from '@/features/auth/theme-toggle';
import { useActiveGoal, useProfile } from '@/features/goals/hooks';
import {
  LANGUAGE_FLAGS,
  LANGUAGE_LABELS,
  useAppLanguage,
  type AppLanguage,
} from '@/i18n';
import { getAppVersion } from '@/lib/app-version';
import { reportError } from '@/lib/errors/report-error';
import { iconSizes, spacing } from '@/theme';
import { useTheme, useThemeColors } from '@/theme/theme-provider';
import { toDiaryDateKey } from '@/utils/date';

function goalLabelKey(type: string): string {
  switch (type) {
    case 'lose_weight':
      return 'account.goalLoseWeight';
    case 'gain_weight':
      return 'account.goalGainWeight';
    case 'maintain_weight':
    default:
      return 'account.goalMaintainWeight';
  }
}

async function openOptionalUrl(url: string | null, unavailableLabel: string) {
  if (!url) {
    Alert.alert(unavailableLabel);
    return;
  }
  try {
    await Linking.openURL(url);
  } catch (err) {
    reportError(err, { area: 'account', action: 'open-legal-url' });
    Alert.alert(unavailableLabel);
  }
}

export default function AccountScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { session, signOut } = useAuth();
  const profile = useProfile();
  const goal = useActiveGoal();
  const language = useAppLanguage();
  const { scheme } = useTheme();
  const adminEntry = useAdminDashboardEntry();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const version = getAppVersion();

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (signOutError) {
      reportError(signOutError, { area: 'auth', action: 'sign-out' });
      setError(toAuthErrorMessage(signOutError));
    } finally {
      setSigningOut(false);
    }
  }

  if (!session) {
    return (
      <Screen scroll slideFrom="bottom" padForTabBar>
        <View style={{ gap: spacing[4] }}>
          <Text variant="headingLarge">{t('account.title')}</Text>
          <Card className="gap-2">
            <Text variant="headingSmall">{t('account.signInPromptTitle')}</Text>
            <Text variant="body" tone="secondary">
              {t('account.signInPromptBody')}
            </Text>
            <Link href="/(auth)/sign-in">
              <Text variant="bodyStrong" tone="brand">
                {t('account.openSignIn')}
              </Text>
            </Link>
          </Card>
        </View>
      </Screen>
    );
  }

  if (profile.isLoading) {
    return (
      <Screen padForTabBar>
        <LoadingState label={t('account.title')} />
      </Screen>
    );
  }

  if (profile.error) {
    return (
      <Screen padForTabBar>
        <ErrorState
          title={t('account.loadError')}
          body={profile.error instanceof Error ? profile.error.message : t('account.retry')}
          onRetry={() => void profile.refetch()}
        />
      </Screen>
    );
  }

  const displayName =
    profile.data?.display_name?.trim() ||
    session.user.email?.split('@')[0] ||
    t('account.title');

  const isDark = scheme === 'dark';

  return (
    <Screen scroll slideFrom="bottom" padForTabBar>
      <View style={{ gap: spacing[5] }}>
        <Text variant="headingLarge">{t('account.title')}</Text>

        <Card style={{ width: '100%' }}>
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('account.editProfile')}
              onPress={() => router.push('/account/edit-profile')}
              cssInterop={false}
              style={({ pressed }) => [
                {
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: 0,
                  marginRight: spacing[4],
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                }}
              >
                <ProfileAvatar
                  displayName={profile.data?.display_name}
                  email={session.user.email}
                  avatarUrl={profile.data?.avatar_url}
                  size={72}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text variant="headingSmall" numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {session.user.email}
                  </Text>
                  <Text variant="caption" tone="secondary" numberOfLines={2}>
                    {goal.data
                      ? t('account.goalSummary', {
                          goal: t(goalLabelKey(goal.data.goal_type)),
                          calories: goal.data.daily_calorie_target,
                        })
                      : t('account.noGoal')}
                  </Text>
                  <Text variant="label" tone="brand">
                    {t('account.editProfile')}
                  </Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('account.signOut')}
              disabled={signingOut}
              onPress={() => void handleSignOut()}
              hitSlop={8}
              style={({ pressed }) => [
                {
                  flexGrow: 0,
                  flexShrink: 0,
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed || signingOut ? 0.55 : 1,
                },
              ]}
            >
              <LogOut size={iconSizes.lg} color={colors.textPrimary} strokeWidth={2.2} />
            </Pressable>
          </View>
        </Card>

        <SettingsSection title={t('account.profile')}>
          <SettingsRow
            icon={UserRound}
            title={t('account.editProfile')}
            subtitle={t('account.profileSubtitle')}
            onPress={() => router.push('/account/edit-profile')}
          />
          <SettingsRow
            icon={Flag}
            title={t('account.goals')}
            subtitle={t('account.goalsSubtitle')}
            onPress={() => router.push('/goals')}
          />
          <SettingsRow
            icon={Scale}
            title={t('account.measurements')}
            subtitle={t('account.measurementsSubtitle')}
            onPress={() => router.push('/measurements')}
          />
          <SettingsRow
            icon={CalendarDays}
            title={t('account.mealPlan')}
            subtitle={t('account.mealPlanSubtitle')}
            onPress={() =>
              router.push({
                pathname: '/food/meal-plan',
                params: { date: toDiaryDateKey() },
              })
            }
          />
          <SettingsRow
            icon={BookOpen}
            title={t('account.recipes')}
            subtitle={t('account.recipesSubtitle')}
            onPress={() => router.push('/food/recipes' as Href)}
          />
        </SettingsSection>

        <SettingsSection title={t('account.preferences')}>
          <SettingsRow
            leading={
              <RNText style={{ fontSize: 18 }}>
                {LANGUAGE_FLAGS[language as AppLanguage] ?? '🌐'}
              </RNText>
            }
            title={t('account.language')}
            trailing={LANGUAGE_LABELS[language as AppLanguage] ?? language}
            onPress={() => router.push('/account/language')}
          />
          <SettingsRow
            icon={isDark ? Moon : Sun}
            title={t('account.appearance')}
            subtitle={isDark ? t('auth.themeDark') : t('auth.themeLight')}
            showChevron={false}
            trailing={<ThemeToggle />}
          />
          <SettingsRow
            icon={Ruler}
            title={t('account.units')}
            trailing={
              profile.data?.units === 'imperial' ? t('account.imperial') : t('account.metric')
            }
            onPress={() => router.push('/account/units')}
          />
          <SettingsRow
            icon={Bell}
            title={t('account.reminders')}
            subtitle={t('account.remindersSubtitle')}
            onPress={() => router.push('/account/reminders')}
          />
        </SettingsSection>

        <SettingsSection title={t('account.privacyData')}>
          <SettingsRow
            icon={Lock}
            title={t('account.accountSecurity')}
            subtitle={session.user.email ?? undefined}
            onPress={() => router.push('/account/security')}
          />
          <SettingsRow
            icon={Download}
            title={t('account.exportData')}
            subtitle={t('account.exportDataSubtitle')}
            onPress={() => router.push('/account/export-data')}
          />
          <SettingsRow
            icon={Upload}
            title={t('account.importData')}
            subtitle={t('account.importDataSubtitle')}
            onPress={() => router.push('/account/import-data')}
          />
          <SettingsRow
            icon={Eraser}
            title={t('account.deleteData')}
            subtitle={t('account.deleteDataSubtitle')}
            destructive
            onPress={() => router.push('/account/delete-data')}
          />
          <SettingsRow
            icon={Trash2}
            title={t('account.deleteAccount')}
            subtitle={t('account.deleteAccountSubtitle')}
            destructive
            onPress={() => router.push('/account/delete-account')}
          />
          <SettingsRow
            icon={Shield}
            title={t('account.privacyPolicy')}
            subtitle={getPrivacyPolicyUrl() ? undefined : t('account.legalUnavailable')}
            onPress={() =>
              void openOptionalUrl(getPrivacyPolicyUrl(), t('account.legalUnavailable'))
            }
          />
          <SettingsRow
            icon={FileText}
            title={t('account.terms')}
            subtitle={getTermsOfServiceUrl() ? undefined : t('account.legalUnavailable')}
            onPress={() =>
              void openOptionalUrl(getTermsOfServiceUrl(), t('account.legalUnavailable'))
            }
          />
        </SettingsSection>

        {adminEntry.visible && adminEntry.url ? (
          <SettingsSection title={t('account.adminSection')}>
            <SettingsRow
              icon={LayoutDashboard}
              title={t('account.openAdmin')}
              subtitle={t('account.openAdminSubtitle')}
              onPress={() =>
                void openOptionalUrl(adminEntry.url, t('account.adminUnavailable'))
              }
            />
          </SettingsSection>
        ) : null}

        <SettingsSection title={t('account.helpAbout')}>
          <SettingsRow
            icon={CircleHelp}
            title={t('account.help')}
            onPress={() => router.push('/account/help')}
          />
          <SettingsRow
            icon={Info}
            title={t('account.about')}
            subtitle={t('account.version', { version })}
            onPress={() => router.push('/account/about')}
          />
        </SettingsSection>

        {error ? (
          <Text variant="bodySmall" tone="error">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
