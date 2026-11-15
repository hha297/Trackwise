import { router } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useDeleteAccount } from '@/features/account/hooks';
import { toAuthErrorMessage } from '@/features/auth/auth-errors';
import { reportError } from '@/lib/errors/report-error';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const deleteAccount = useDeleteAccount();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <ChromeIconButton
            header
            label={t('account.cancel')}
            onPress={() => router.back()}
            icon={(color) => <X size={22} color={color} />}
          />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.deleteAccount')}
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
            {t('account.deleteConfirmBody')}
          </Text>
          <Button
            label={t('account.deleteConfirmAction')}
            variant="destructive"
            loading={deleteAccount.isPending}
            disabled={deleteAccount.isPending}
            iconStart={(color) => <Trash2 size={18} color={color} />}
            onPress={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          />
          {error ? (
            <Text variant="bodySmall" tone="error">
              {error}
            </Text>
          ) : null}
        </View>
      </View>

      <DeleteConfirmDialog
        visible={confirmOpen}
        title={t('account.deleteConfirmTitle')}
        body={t('account.deleteConfirmBody')}
        cancelLabel={t('account.cancel')}
        confirmLabel={t('account.deleteConfirmAction')}
        loading={deleteAccount.isPending}
        onCancel={() => {
          if (!deleteAccount.isPending) setConfirmOpen(false);
        }}
        onConfirm={() => {
          void (async () => {
            try {
              await deleteAccount.mutateAsync();
              setConfirmOpen(false);
              router.replace('/(auth)/sign-in');
            } catch (err) {
              reportError(err, { area: 'account', action: 'delete-account' });
              setConfirmOpen(false);
              setError(err instanceof Error ? err.message : toAuthErrorMessage(err));
            }
          })();
        }}
      />
    </Screen>
  );
}
