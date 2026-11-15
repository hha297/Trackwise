import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { SelectionCard } from '@/features/setup/selection-card';
import { useSetup } from '@/features/setup/setup-provider';
import { SetupShell } from '@/features/setup/setup-shell';

export function SafetyStep() {
  const { t } = useTranslation();
  const { answers, progress, goNext, goBack, saving, error } = useSetup();
  const [value, setValue] = useState<boolean | null>(answers.isPregnantOrBreastfeeding);
  const [manualCalories, setManualCalories] = useState(
    answers.manualDailyCalories != null ? String(answers.manualDailyCalories) : '',
  );
  const [touched, setTouched] = useState(false);

  const needsManual = value === true;
  const parsedManual = Number(manualCalories);
  const manualOk = !needsManual || (Number.isFinite(parsedManual) && parsedManual >= 1200);
  const showError = touched && (value === null || !manualOk);

  return (
    <SetupShell
      title={t('setup.safety.title')}
      subtitle={t('setup.safety.subtitle')}
      stepIndex={progress.index}
      stepTotal={progress.total}
      onBack={() => void goBack()}
      continueDisabled={saving}
      continueLoading={saving}
      onContinue={() => {
        setTouched(true);
        if (value === null || !manualOk) return;
        void goNext({
          isPregnantOrBreastfeeding: value,
          manualDailyCalories: needsManual ? parsedManual : answers.manualDailyCalories,
        });
      }}
    >
      <View className="gap-3">
        <Text variant="label" tone="secondary">
          {t('setup.safety.question')}
        </Text>
        <SelectionCard
          label={t('setup.safety.no')}
          selected={value === false}
          onPress={() => setValue(false)}
        />
        <SelectionCard
          label={t('setup.safety.yes')}
          description={t('setup.safety.yesDescription')}
          selected={value === true}
          onPress={() => setValue(true)}
        />

        {needsManual ? (
          <Input
            label={t('setup.safety.calorieLabel')}
            value={manualCalories}
            onChangeText={setManualCalories}
            keyboardType="number-pad"
            placeholder={t('setup.safety.caloriePlaceholder')}
            error={touched && !manualOk ? t('setup.safety.calorieError') : undefined}
          />
        ) : null}

        {showError && value === null ? (
          <Text variant="caption" tone="error">
            {t('setup.safety.chooseError')}
          </Text>
        ) : null}
        {error ? (
          <Text variant="caption" tone="error">
            {error}
          </Text>
        ) : null}
      </View>
    </SetupShell>
  );
}
