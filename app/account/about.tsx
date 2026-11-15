import { router } from 'expo-router';
import {
  CircleHelp,
  ExternalLink,
  FileText,
  Mail,
  Shield,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  getPrivacyPolicyUrl,
  getSupportEmail,
  getTermsOfServiceUrl,
  getWebsiteUrl,
} from '@/features/account/constants';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { SettingsRow, SettingsSection } from '@/features/account/settings-row';
import { getAppVersion } from '@/lib/app-version';
import { reportError } from '@/lib/errors/report-error';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

async function openOptionalUrl(url: string | null, unavailableLabel: string) {
  if (!url) {
    Alert.alert(unavailableLabel);
    return;
  }
  try {
    await Linking.openURL(url);
  } catch (err) {
    reportError(err, { area: 'account', action: 'open-url' });
    Alert.alert(unavailableLabel);
  }
}

const WHAT_KEYS = [
  'aboutWhatLogging',
  'aboutWhatWorkouts',
  'aboutWhatGoals',
  'aboutWhatProgress',
] as const;

export default function AboutScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const version = getAppVersion();
  const supportEmail = getSupportEmail();
  const failed = t('account.openUrlFailed');

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <HeaderDoneButton />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.about')}
          </Text>
        </View>

        <View
          style={{
            padding: spacing[5],
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            gap: spacing[3],
            alignItems: 'center',
          }}
        >
          <BrandMark size="md" />
          <Text variant="bodyStrong" style={{ textAlign: 'center' }}>
            {t('account.aboutTagline')}
          </Text>
          <Text variant="caption" tone="muted">
            {t('account.version', { version })}
          </Text>
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            {t('account.aboutBody')}
          </Text>
        </View>

        <View
          style={{
            padding: spacing[4],
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            gap: spacing[3],
          }}
        >
          <Text variant="label" tone="secondary">
            {t('account.aboutWhatTitle')}
          </Text>
          {WHAT_KEYS.map((key) => (
            <View key={key} className="flex-row gap-3">
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  marginTop: 7,
                  backgroundColor: colors.primary,
                }}
              />
              <Text variant="body" className="flex-1">
                {t(`account.${key}`)}
              </Text>
            </View>
          ))}
        </View>

        <SettingsSection>
          <SettingsRow
            icon={CircleHelp}
            title={t('account.help')}
            onPress={() => router.push('/account/help')}
          />
          <SettingsRow
            icon={ExternalLink}
            title={t('account.aboutWebsite')}
            subtitle={t('account.aboutWebsiteSubtitle')}
            onPress={() => {
              void openOptionalUrl(getWebsiteUrl(), failed);
            }}
          />
          <SettingsRow
            icon={Mail}
            title={t('account.support')}
            subtitle={supportEmail ?? t('account.legalUnavailable')}
            showChevron={Boolean(supportEmail)}
            onPress={
              supportEmail
                ? () => {
                    void openOptionalUrl(`mailto:${supportEmail}`, failed);
                  }
                : undefined
            }
          />
          <SettingsRow
            icon={Shield}
            title={t('account.privacyPolicy')}
            onPress={() =>
              void openOptionalUrl(getPrivacyPolicyUrl(), failed)
            }
          />
          <SettingsRow
            icon={FileText}
            title={t('account.terms')}
            onPress={() =>
              void openOptionalUrl(getTermsOfServiceUrl(), failed)
            }
          />
        </SettingsSection>
      </View>
    </Screen>
  );
}
