import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { SelectionCard } from '@/features/setup/selection-card';
import { SetupShell } from '@/features/setup/setup-shell';
import { useSetup } from '@/features/setup/setup-provider';
import type { GoalType } from '@/features/setup/calculations';

const GOAL_VALUES: GoalType[] = ['lose_weight', 'maintain_weight', 'gain_weight'];

export function GoalStep() {
  const { t } = useTranslation();
  const { answers, progress, goNext, goBack, saving, error } = useSetup();
  const [goalType, setGoalType] = useState<GoalType | null>(answers.goalType);
  const [touched, setTouched] = useState(false);
  const showError = touched && !goalType;

  const canContinue = Boolean(goalType);

  return (
    <SetupShell
      title={t('setup.goal.title')}
      subtitle={t('setup.goal.subtitle')}
      stepIndex={progress.index}
      stepTotal={progress.total}
      onBack={progress.index > 0 ? () => void goBack() : undefined}
      continueDisabled={!canContinue || saving}
      continueLoading={saving}
      onContinue={() => {
        setTouched(true);
        if (!goalType) return;
        void goNext({ goalType });
      }}
    >
      <View className="gap-3">
        {GOAL_VALUES.map((value) => (
          <SelectionCard
            key={value}
            label={t(`setup.goal.${value}.label`)}
            description={t(`setup.goal.${value}.description`)}
            selected={goalType === value}
            onPress={() => setGoalType(value)}
          />
        ))}
        {showError ? (
          <Text variant="caption" tone="error">
            {t('setup.goal.error')}
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
