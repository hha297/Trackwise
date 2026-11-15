import { Ruler } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { useUpdateProfile } from '@/features/account/hooks';
import { SelectedCheck } from '@/features/account/selected-check';
import { SettingsRow, SettingsSection } from '@/features/account/settings-row';
import { useProfile } from '@/features/goals/hooks';
import { reportError } from '@/lib/errors/report-error';
import { spacing } from '@/theme';

export default function UnitsScreen() {
  const { t } = useTranslation();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);

  async function setUnits(units: 'metric' | 'imperial') {
    setError(null);
    try {
      await updateProfile.mutateAsync({ units });
    } catch (err) {
      reportError(err, { area: 'account', action: 'update-units' });
      setError(err instanceof Error ? err.message : t('account.unitsUpdateError'));
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <HeaderDoneButton />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.units')}
          </Text>
        </View>

        <SettingsSection>
          <SettingsRow
            icon={Ruler}
            title={t('account.metric')}
            subtitle={t('account.metricSubtitle')}
            showChevron={false}
            trailing={<SelectedCheck visible={profile.data?.units === 'metric'} />}
            onPress={() => void setUnits('metric')}
          />
          <SettingsRow
            icon={Ruler}
            title={t('account.imperial')}
            subtitle={t('account.imperialSubtitle')}
            showChevron={false}
            trailing={<SelectedCheck visible={profile.data?.units === 'imperial'} />}
            onPress={() => void setUnits('imperial')}
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
