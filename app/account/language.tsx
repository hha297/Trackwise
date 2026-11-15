import { useTranslation } from 'react-i18next';
import { Text as RNText, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { SelectedCheck } from '@/features/account/selected-check';
import { SettingsRow, SettingsSection } from '@/features/account/settings-row';
import {
  LANGUAGE_FLAGS,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  changeAppLanguage,
  type AppLanguage,
  useAppLanguage,
} from '@/i18n';
import { spacing } from '@/theme';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const language = useAppLanguage();

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <HeaderDoneButton />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.language')}
          </Text>
        </View>

        <SettingsSection>
          {SUPPORTED_LANGUAGES.map((code) => (
            <SettingsRow
              key={code}
              leading={
                <RNText style={{ fontSize: 20 }} accessibilityLabel={LANGUAGE_LABELS[code]}>
                  {LANGUAGE_FLAGS[code]}
                </RNText>
              }
              title={LANGUAGE_LABELS[code]}
              showChevron={false}
              trailing={<SelectedCheck visible={language === code} />}
              onPress={() => {
                void changeAppLanguage(code as AppLanguage);
              }}
            />
          ))}
        </SettingsSection>
      </View>
    </Screen>
  );
}
