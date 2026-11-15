import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { SelectionCard } from '@/features/setup/selection-card';
import { useSetup } from '@/features/setup/setup-provider';
import { SetupShell } from '@/features/setup/setup-shell';
import { useThemeColors } from '@/theme/theme-provider';

const PATTERN_VALUES = ['none', 'vegetarian', 'vegan', 'high_protein'] as const;

/**
 * Optional preferences. Allergies / “foods to avoid” are deferred until food
 * filtering exists in the diary — we don’t collect data we can’t use yet.
 */
export function DietaryStep() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { answers, progress, goNext, goBack, saving, error } = useSetup();
  const [pattern, setPattern] = useState<string | null>(answers.dietaryPattern);
  const [meals, setMeals] = useState(
    answers.mealsPerDay != null ? String(Math.min(6, answers.mealsPerDay)) : null,
  );

  const mealOptions = useMemo(
    () => [
      ...[1, 2, 3, 4, 5].map((count) => ({
        value: String(count),
        label: t('setup.dietary.mealsCount', { count }),
      })),
      { value: '6', label: t('setup.dietary.mealsSixPlus') },
    ],
    [t],
  );

  return (
    <SetupShell
      title={t('setup.dietary.title')}
      subtitle={t('setup.dietary.subtitle')}
      stepIndex={progress.index}
      stepTotal={progress.total}
      onBack={() => void goBack()}
      continueLabel={t('setup.continue')}
      continueDisabled={saving}
      continueLoading={saving}
      onContinue={() => {
        const mealsNum = meals == null ? null : Number(meals);
        void goNext({
          dietaryPattern: pattern === 'none' ? null : pattern,
          mealsPerDay: Number.isFinite(mealsNum as number) ? (mealsNum as number) : null,
        });
      }}
      footer={
        <Text
          variant="bodyStrong"
          style={{ color: colors.primary }}
          onPress={() => {
            void goNext({ dietaryPattern: null, mealsPerDay: null });
          }}
        >
          {t('setup.dietary.skip')}
        </Text>
      }
    >
      <View className="gap-3">
        <Text variant="label" tone="secondary">
          {t('setup.dietary.patternLabel')}
        </Text>
        {PATTERN_VALUES.map((value) => (
          <SelectionCard
            key={value}
            label={t(
              value === 'none'
                ? 'setup.dietary.none'
                : value === 'vegetarian'
                  ? 'setup.dietary.vegetarian'
                  : value === 'vegan'
                    ? 'setup.dietary.vegan'
                    : 'setup.dietary.highProtein',
            )}
            selected={pattern === value}
            onPress={() => setPattern(value)}
          />
        ))}
        <Select
          label={t('setup.dietary.mealsLabel')}
          value={meals}
          options={mealOptions}
          placeholder={t('setup.dietary.mealsPlaceholder')}
          onChange={setMeals}
        />
        <Text variant="caption" tone="muted">
          {t('setup.dietary.allergyNote')}
        </Text>
        {error ? (
          <Text variant="caption" tone="error">
            {error}
          </Text>
        ) : null}
      </View>
    </SetupShell>
  );
}
