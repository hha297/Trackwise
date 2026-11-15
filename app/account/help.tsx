import { ExternalLink, Mail, MessageSquareText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  getFeedbackUrl,
  getSupportCenterUrl,
  getSupportEmail,
} from '@/features/account/constants';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { SettingsRow, SettingsSection } from '@/features/account/settings-row';
import { reportError } from '@/lib/errors/report-error';
import { spacing } from '@/theme';

const HELP_TOPIC_KEYS = [
  'logging',
  'scan',
  'estimates',
  'workouts',
  'goals',
  'account',
] as const;

async function openUrl(url: string, failedLabel: string) {
  try {
    await Linking.openURL(url);
  } catch (err) {
    reportError(err, { area: 'account', action: 'open-help-url' });
    Alert.alert(failedLabel);
  }
}

export default function HelpScreen() {
  const { t } = useTranslation();
  const supportEmail = getSupportEmail();
  const failed = t('account.openUrlFailed');

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <HeaderDoneButton />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.help')}
          </Text>
        </View>

        <Text variant="body" tone="secondary">
          {t('account.helpIntro')}
        </Text>

        <View style={{ gap: spacing[3] }}>
          {HELP_TOPIC_KEYS.map((key) => (
            <Card key={key} className="gap-2">
              <Text variant="headingSmall">
                {t(`account.helpTopics.${key}Title`)}
              </Text>
              <Text variant="body" tone="secondary">
                {t(`account.helpTopics.${key}Body`)}
              </Text>
            </Card>
          ))}
        </View>

        <SettingsSection title={t('account.helpContactTitle')}>
          <SettingsRow
            icon={Mail}
            title={t('account.helpEmailSupport')}
            subtitle={supportEmail ?? t('account.legalUnavailable')}
            showChevron={Boolean(supportEmail)}
            onPress={
              supportEmail
                ? () => {
                    void openUrl(`mailto:${supportEmail}`, failed);
                  }
                : undefined
            }
          />
          <SettingsRow
            icon={ExternalLink}
            title={t('account.helpOpenSupportCenter')}
            subtitle={getSupportCenterUrl()}
            onPress={() => {
              void openUrl(getSupportCenterUrl(), failed);
            }}
          />
          <SettingsRow
            icon={MessageSquareText}
            title={t('account.helpSendFeedback')}
            subtitle={getFeedbackUrl()}
            onPress={() => {
              void openUrl(getFeedbackUrl(), failed);
            }}
          />
        </SettingsSection>
      </View>
    </Screen>
  );
}
