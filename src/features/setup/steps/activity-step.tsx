import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { ActivityLevel } from '@/features/setup/calculations';
import { SelectionCard } from '@/features/setup/selection-card';
import { useSetup } from '@/features/setup/setup-provider';
import { SetupShell } from '@/features/setup/setup-shell';

const LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'demanding'];

export function ActivityStep() {
  const { t } = useTranslation();
  const { answers, progress, goNext, goBack, saving, error } = useSetup();
  const [level, setLevel] = useState<ActivityLevel | null>(answers.activityLevel);
  const [steps, setSteps] = useState(
    answers.averageDailySteps != null ? String(answers.averageDailySteps) : '',
  );
  const [touched, setTouched] = useState(false);

  return (
    <SetupShell
      title={t('setup.activity.title')}
      subtitle={t('setup.activity.subtitle')}
      stepIndex={progress.index}
      stepTotal={progress.total}
      onBack={() => void goBack()}
      continueDisabled={saving}
      continueLoading={saving}
      onContinue={() => {
        setTouched(true);
        if (!level) return;
        const parsed = steps.trim() === '' ? null : Number(steps);
        void goNext({
          activityLevel: level,
          averageDailySteps: Number.isFinite(parsed as number) ? (parsed as number) : null,
        });
      }}
    >
      <View className="gap-3">
        {LEVELS.map((value) => (
          <SelectionCard
            key={value}
            label={t(`setup.activity.${value}.label`)}
            description={t(`setup.activity.${value}.description`)}
            selected={level === value}
            onPress={() => setLevel(value)}
          />
        ))}
        <Input
          label={t('setup.activity.stepsLabel')}
          value={steps}
          onChangeText={setSteps}
          keyboardType="number-pad"
          placeholder={t('setup.activity.stepsPlaceholder')}
        />
        {touched && !level ? (
          <Text variant="caption" tone="error">
            {t('setup.activity.error')}
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
