import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { backupFilenameForDate, shareJsonFile } from '@/features/account/export-file';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { useExportUserData } from '@/features/account/hooks';
import { toAuthErrorMessage } from '@/features/auth/auth-errors';
import { reportError } from '@/lib/errors/report-error';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export default function ExportDataScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const exportData = useExportUserData();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);

  async function onExport() {
    setError(null);
    setDone(false);
    setFilename(null);
    try {
      const payload = await exportData.mutateAsync();
      const name = backupFilenameForDate(
        payload.exportedAt ? new Date(payload.exportedAt) : new Date(),
      );
      const json = JSON.stringify(payload, null, 2);
      await shareJsonFile(name, json);
      setFilename(name);
      setDone(true);
    } catch (err) {
      reportError(err, { area: 'account', action: 'export-data' });
      setError(err instanceof Error ? err.message : toAuthErrorMessage(err));
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <HeaderDoneButton />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.exportData')}
          </Text>
        </View>

        <View
          style={{
            gap: spacing[3],
            padding: spacing[4],
            borderRadius: radii.md,
            backgroundColor: colors.surface,
          }}
        >
          <Text variant="body" tone="secondary">
            {t('account.exportDataSubtitle')}
          </Text>
          <Text variant="bodySmall" tone="secondary">
            {t('account.exportDataIncludes')}
          </Text>
          <Button
            label={t('account.exportDataAction')}
            loading={exportData.isPending}
            disabled={exportData.isPending}
            iconStart={(color) => <Download size={18} color={color} />}
            onPress={() => void onExport()}
          />
          {done ? (
            <Text variant="bodySmall" tone="success">
              {filename
                ? t('account.exportReadyFile', { filename })
                : t('account.exportReadyBody')}
            </Text>
          ) : null}
          {error ? (
            <Text variant="bodySmall" tone="error">
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
