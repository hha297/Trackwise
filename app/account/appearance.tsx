import { Moon, Sun } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { SettingsRow, SettingsSection } from '@/features/account/settings-row';
import { ThemeToggle } from '@/features/auth/theme-toggle';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/theme-provider';

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <HeaderDoneButton />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.appearance')}
          </Text>
        </View>

        <SettingsSection>
          <SettingsRow
            icon={isDark ? Moon : Sun}
            title={isDark ? t('auth.themeDark') : t('auth.themeLight')}
            showChevron={false}
            trailing={<ThemeToggle />}
          />
        </SettingsSection>
      </View>
    </Screen>
  );
}
