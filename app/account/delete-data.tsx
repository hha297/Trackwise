import { Link, router } from 'expo-router';
import { Eraser } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { useWipeUserData } from '@/features/account/hooks';
import { toAuthErrorMessage } from '@/features/auth/auth-errors';
import { reportError } from '@/lib/errors/report-error';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const CONFIRM_PHRASE = 'DELETE DATA';

export default function DeleteDataScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const wipeData = useWipeUserData();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <HeaderDoneButton />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.deleteData')}
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
            {t('account.deleteDataSubtitle')}
          </Text>
          <Text variant="bodySmall" tone="secondary">
            {t('account.deleteDataRemoves')}
          </Text>
          <Text variant="bodySmall" tone="secondary">
            {t('account.deleteDataKeeps')}
          </Text>
          <Text variant="bodySmall" tone="secondary">
            {t('account.deleteDataExportHint')}{' '}
            <Link href="/account/export-data">
              <Text variant="bodySmall" tone="brand">
                {t('account.exportData')}
              </Text>
            </Link>
          </Text>
          <Text variant="bodySmall" tone="muted">
            {t('account.deleteDataVsAccount')}
          </Text>

          <Button
            label={t('account.deleteDataAction')}
            variant="destructive"
            loading={wipeData.isPending}
            disabled={wipeData.isPending || done}
            iconStart={(color) => <Eraser size={18} color={color} />}
            onPress={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          />
          {done ? (
            <Text variant="bodySmall" tone="success">
              {t('account.deleteDataDone')}
            </Text>
          ) : null}
          {error ? (
            <Text variant="bodySmall" tone="error">
              {error}
            </Text>
          ) : null}
        </View>

        <Pressable onPress={() => router.push('/account/delete-account')}>
          <Text variant="caption" tone="muted">
            {t('account.deleteDataNeedAccountDelete')}
          </Text>
        </Pressable>
      </View>

      <DeleteConfirmDialog
        visible={confirmOpen}
        title={t('account.deleteDataConfirmTitle')}
        body={t('account.deleteDataConfirmBody')}
        cancelLabel={t('account.cancel')}
        confirmLabel={t('account.deleteDataConfirmAction')}
        confirmPhrase={CONFIRM_PHRASE}
        confirmPhraseLabel={t('account.deleteDataTypePhrase', { phrase: CONFIRM_PHRASE })}
        loading={wipeData.isPending}
        onCancel={() => {
          if (!wipeData.isPending) setConfirmOpen(false);
        }}
        onConfirm={() => {
          void (async () => {
            try {
              await wipeData.mutateAsync();
              setConfirmOpen(false);
              setDone(true);
            } catch (err) {
              reportError(err, { area: 'account', action: 'wipe-user-data' });
              setConfirmOpen(false);
              setError(err instanceof Error ? err.message : toAuthErrorMessage(err));
            }
          })();
        }}
      />
    </Screen>
  );
}
