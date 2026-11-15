import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/theme/theme-provider';

import type { FoodPickerIntent } from './picker-intent';
import { parsePositiveAmount } from './scan-calculations';
import { FoodLogContextPicker } from './scan-result-modal';
import type { MealType } from './types';
import { NutritionMacrosRow } from './nutrition-macros-row';

export type ConfirmSelectionItem = {
  name: string;
  brand?: string | null;
  /** Macros for one unit of the amount field (usually 1 serving). */
  perUnit: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  amountUnit: 'g' | 'ml' | 'serving';
  defaultAmount: number;
  servingHint?: string | null;
};

type ConfirmSelectionModalProps = {
  item: ConfirmSelectionItem | null;
  intent: FoodPickerIntent;
  dateKey: string;
  mealType: MealType;
  saving?: boolean;
  onClose: () => void;
  onDate: (dateKey: string) => void;
  onMeal: (meal: MealType) => void;
  onConfirm: (input: {
    amount: number;
    amountUnit: 'g' | 'ml' | 'serving';
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    servingLabel: string;
  }) => Promise<void>;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/** Shared quantity confirm for Food Picker (log or plan). */
export function ConfirmSelectionModal({
  item,
  intent,
  dateKey,
  mealType,
  saving = false,
  onClose,
  onDate,
  onMeal,
  onConfirm,
}: ConfirmSelectionModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [amountText, setAmountText] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [boundName, setBoundName] = useState<string | null>(null);

  useEffect(() => {
    if (item && item.name !== boundName) {
      setBoundName(item.name);
      setAmountText(String(item.defaultAmount));
      setError(null);
    } else if (!item && boundName != null) {
      setBoundName(null);
    }
  }, [item, boundName]);

  const parsed = parsePositiveAmount(amountText);
  const preview = useMemo(() => {
    if (!item || !parsed) return null;
    return {
      calories: round1(item.perUnit.calories * parsed),
      proteinG: round1(item.perUnit.proteinG * parsed),
      carbsG: round1(item.perUnit.carbsG * parsed),
      fatG: round1(item.perUnit.fatG * parsed),
    };
  }, [item, parsed]);

  const amountLabel =
    item?.amountUnit === 'serving'
      ? t('food.confirm.servings')
      : t('food.confirm.amount', { unit: item?.amountUnit ?? 'g' });

  const primaryLabel =
    intent === 'plan'
      ? saving
        ? t('food.confirm.addingToPlan')
        : t('food.confirm.addToPlan')
      : saving
        ? t('food.confirm.logging')
        : t('food.confirm.logToDiary');

  async function submit() {
    if (!item || !parsed || !preview) {
      setError(t('food.confirm.amountRequired'));
      return;
    }
    setError(null);
    const servingLabel =
      item.amountUnit === 'serving'
        ? `${parsed} servings`
        : `${parsed} ${item.amountUnit}${item.servingHint ? ` · ${item.servingHint}` : ''}`;
    try {
      await onConfirm({
        amount: parsed,
        amountUnit: item.amountUnit,
        calories: preview.calories,
        proteinG: preview.proteinG,
        carbsG: preview.carbsG,
        fatG: preview.fatG,
        servingLabel,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('food.add.logFailed'));
    }
  }

  return (
    <Modal
      visible={Boolean(item)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View className="flex-1 gap-4 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text variant="headingMedium">
              {intent === 'plan' ? t('food.confirm.titlePlan') : t('food.confirm.titleLog')}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text variant="bodyStrong" tone="secondary">
                {t('common.close')}
              </Text>
            </Pressable>
          </View>

          {item ? (
            <>
              <View className="gap-1">
                <Text variant="bodyStrong">{item.name}</Text>
                {item.brand ? (
                  <Text variant="caption" tone="secondary">
                    {item.brand}
                  </Text>
                ) : null}
                {item.servingHint ? (
                  <Text variant="caption" tone="muted">
                    {item.servingHint}
                  </Text>
                ) : null}
              </View>

              <Input
                label={amountLabel}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
              />

              {preview ? (
                <NutritionMacrosRow
                  showCalories
                  calories={preview.calories}
                  proteinG={preview.proteinG}
                  carbsG={preview.carbsG}
                  fatG={preview.fatG}
                />
              ) : null}

              <FoodLogContextPicker
                dateKey={dateKey}
                mealType={mealType}
                onDate={onDate}
                onMeal={onMeal}
              />

              {error ? (
                <Text variant="bodySmall" tone="error">
                  {error}
                </Text>
              ) : null}

              <Button
                label={primaryLabel}
                size="lg"
                disabled={!parsed || !preview || saving}
                loading={saving}
                onPress={() => void submit()}
              />
            </>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
