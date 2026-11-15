import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  parseTrackwiseBackupJson,
  type BackupSummary,
  type TrackwiseBackup,
} from '@/features/account/backup';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { useImportUserData } from '@/features/account/hooks';
import type { ImportMode } from '@/features/account/import-user-data';
import { toAuthErrorMessage } from '@/features/auth/auth-errors';
import { reportError } from '@/lib/errors/report-error';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const REPLACE_PHRASE = 'REPLACE';

export default function ImportDataScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const importData = useImportUserData();
  const [error, setError] = useState<string | null>(null);
  const [backup, setBackup] = useState<TrackwiseBackup | null>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [done, setDone] = useState(false);

  const summaryLines = useMemo(() => {
    if (!summary) return [];
    return [
      t('account.importCountGoals', { count: summary.goals }),
      t('account.importCountMeasurements', { count: summary.bodyMeasurements }),
      t('account.importCountFoodEntries', { count: summary.foodEntries }),
      t('account.importCountFoods', { count: summary.foods }),
      t('account.importCountWorkouts', { count: summary.workouts }),
      t('account.importCountTemplates', { count: summary.workoutTemplates }),
      t('account.importCountCustomExercises', { count: summary.customExercises }),
    ];
  }, [summary, t]);

  async function onPick() {
    setError(null);
    setDone(false);
    setBackup(null);
    setSummary(null);
    setPickedName(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'public.json', 'text/json'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setPickedName(asset.name ?? 'backup.json');
      const file = new File(asset.uri);
      const text = await file.text();
      const validated = parseTrackwiseBackupJson(text);
      if (!validated.ok) {
        setError(validated.error);
        return;
      }
      setBackup(validated.backup);
      setSummary(validated.summary);
    } catch (err) {
      reportError(err, { area: 'account', action: 'pick-import-file' });
      setError(err instanceof Error ? err.message : toAuthErrorMessage(err));
    }
  }

  async function runImport(selected: ImportMode) {
    if (!backup) return;
    setError(null);
    setDone(false);
    try {
      await importData.mutateAsync({ backup, mode: selected });
      setReplaceOpen(false);
      setDone(true);
    } catch (err) {
      reportError(err, { area: 'account', action: 'import-data' });
      setReplaceOpen(false);
      setError(err instanceof Error ? err.message : toAuthErrorMessage(err));
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start gap-2">
          <HeaderDoneButton />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('account.importData')}
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
            {t('account.importDataSubtitle')}
          </Text>
          <Button
            label={t('account.importPickFile')}
            variant="secondary"
            iconStart={(color) => <Upload size={18} color={color} />}
            disabled={importData.isPending}
            onPress={() => void onPick()}
          />
          {pickedName ? (
            <Text variant="bodySmall" tone="secondary">
              {t('account.importPickedFile', { filename: pickedName })}
            </Text>
          ) : null}

          {summary ? (
            <View style={{ gap: spacing[2] }}>
              <Text variant="headingSmall">{t('account.importSummary')}</Text>
              {summaryLines.map((line) => (
                <Text key={line} variant="bodySmall" tone="secondary">
                  {line}
                </Text>
              ))}
              {backup ? (
                <Text variant="caption" tone="muted">
                  {t('account.importMeta', {
                    version: backup.version,
                    exportedAt: backup.exportedAt.slice(0, 10),
                    appVersion: backup.appVersion,
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}

          {backup ? (
            <View style={{ gap: spacing[2] }}>
              <Text variant="headingSmall">{t('account.importMode')}</Text>
              <ModeOption
                selected={mode === 'merge'}
                title={t('account.importModeMerge')}
                body={t('account.importModeMergeBody')}
                onPress={() => setMode('merge')}
              />
              <ModeOption
                selected={mode === 'replace'}
                title={t('account.importModeReplace')}
                body={t('account.importModeReplaceBody')}
                onPress={() => setMode('replace')}
              />
              <Button
                label={t('account.importConfirm')}
                loading={importData.isPending}
                disabled={importData.isPending}
                onPress={() => {
                  if (mode === 'replace') {
                    setReplaceOpen(true);
                    return;
                  }
                  void runImport('merge');
                }}
              />
            </View>
          ) : null}

          {done ? (
            <Text variant="bodySmall" tone="success">
              {t('account.importDone')}
            </Text>
          ) : null}
          {error ? (
            <Text variant="bodySmall" tone="error">
              {error}
            </Text>
          ) : null}
        </View>
      </View>

      <DeleteConfirmDialog
        visible={replaceOpen}
        title={t('account.importReplaceConfirmTitle')}
        body={t('account.importReplaceConfirmBody')}
        cancelLabel={t('account.cancel')}
        confirmLabel={t('account.importReplaceConfirmAction')}
        confirmPhrase={REPLACE_PHRASE}
        confirmPhraseLabel={t('account.importReplaceTypePhrase', { phrase: REPLACE_PHRASE })}
        loading={importData.isPending}
        onCancel={() => {
          if (!importData.isPending) setReplaceOpen(false);
        }}
        onConfirm={() => {
          void runImport('replace');
        }}
      />
    </Screen>
  );
}

function ModeOption({
  selected,
  title,
  body,
  onPress,
}: {
  selected: boolean;
  title: string;
  body: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        gap: spacing[1],
        padding: spacing[3],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primaryMuted : colors.background,
      }}
    >
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="bodySmall" tone="secondary">
        {body}
      </Text>
    </Pressable>
  );
}
