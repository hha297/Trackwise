import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { FoodEntryEditModal } from '@/features/diary/components/food-entry-edit-modal';
import { useDeleteFoodEntry, useUpdateFoodEntryAmount } from '@/features/food/hooks';
import type { FoodEntry } from '@/features/food/types';
import { parsePositiveAmount } from '@/features/food/scan-calculations';
import { getSupabase } from '@/lib/supabase/client';
import { radii, spacing, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

import { usePlannedMealMutations } from './hooks';
import { PlannedMealAlreadyLoggedError } from './log-to-diary';
import { derivePlannedMealLogStatus } from './status';
import type { PlannedMeal, PlannedMealLogStatus } from './types';

type PlannedMealLogControlsProps = {
  meal: PlannedMeal;
  /** When true, hide title (parent already shows it). */
  compact?: boolean;
};

function statusTone(
  status: PlannedMealLogStatus,
  colors: ReturnType<typeof useThemeColors>,
): { bg: string; fg: string; labelKey: string } {
  switch (status) {
    case 'logged':
      return {
        bg: withAlpha(colors.macroCalories, 0.16),
        fg: colors.macroCalories,
        labelKey: 'mealPlan.logStatus.logged',
      };
    case 'partial':
      return {
        bg: withAlpha(colors.macroFat, 0.18),
        fg: colors.macroFat,
        labelKey: 'mealPlan.logStatus.partial',
      };
    default:
      return {
        bg: colors.surfaceMuted,
        fg: colors.textSecondary,
        labelKey: 'mealPlan.logStatus.planned',
      };
  }
}

async function fetchFoodEntry(id: string): Promise<FoodEntry | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('food_entries')
    .select(
      'id, food_id, logged_on, meal_type, quantity, food_name, brand, serving_label, calories, protein_g, carbs_g, fat_g, amount, amount_unit, nutrition_basis, basis_amount, basis_unit, image_url, fiber_g, sugars_g, saturated_fat_g, sodium_mg, planned_meal_id, recipe_id, entry_source',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as FoodEntry | null) ?? null;
}

/** Log / status / edit controls for a planned meal (Meal Plan + Diary). */
export function PlannedMealLogControls({ meal, compact = false }: PlannedMealLogControlsProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const mutations = usePlannedMealMutations();
  const updateEntry = useUpdateFoodEntryAmount();
  const deleteEntry = useDeleteFoodEntry();

  const status = derivePlannedMealLogStatus(meal);
  const tone = statusTone(status, colors);
  const plannedServings = Number(meal.servings);
  const [adjusting, setAdjusting] = useState(false);
  const [servingsText, setServingsText] = useState(String(meal.servings));
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);

  const logging = mutations.logToDiary.isPending;
  const adjusted = parsePositiveAmount(servingsText);
  const logAmount =
    adjusting && adjusted && adjusted > 0 ? adjusted : plannedServings > 0 ? plannedServings : null;

  async function logNow(servings: number) {
    setError(null);
    if (!(servings > 0)) {
      setError(t('mealPlan.errors.servingsRequired'));
      return;
    }
    try {
      await mutations.logToDiary.mutateAsync({
        plannedMealId: meal.id,
        actualServings: servings,
        dateKey: meal.plan_date,
      });
      setAdjusting(false);
    } catch (err) {
      if (err instanceof PlannedMealAlreadyLoggedError) {
        setError(t('mealPlan.errors.alreadyLogged'));
        return;
      }
      setError(err instanceof Error ? err.message : t('mealPlan.errors.logFailed'));
    }
  }

  async function openEdit() {
    if (!meal.logged_food_entry_id) return;
    setError(null);
    try {
      const entry = await fetchFoodEntry(meal.logged_food_entry_id);
      if (!entry) {
        setError(t('mealPlan.errors.entryMissing'));
        return;
      }
      setEditingEntry(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mealPlan.errors.entryMissing'));
    }
  }

  return (
    <View style={{ gap: spacing[2] }}>
      {!compact ? (
        <>
          <Text variant="bodyStrong" numberOfLines={2}>
            {meal.title}
          </Text>
          <Text variant="caption" tone="secondary">
            {Math.round(meal.calories)} {t('diary.meals.kcalUnit')} ·{' '}
            {t('mealPlan.servingsLabel', { count: meal.servings })}
          </Text>
        </>
      ) : null}

      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: spacing[2],
          paddingVertical: 3,
          borderRadius: radii.pill,
          backgroundColor: tone.bg,
        }}
      >
        <Text variant="caption" style={{ color: tone.fg }}>
          {t(tone.labelKey)}
        </Text>
      </View>

      {status === 'planned' ? (
        adjusting ? (
          <View style={{ gap: spacing[2] }}>
            <Input
              label={t('mealPlan.servingsEaten')}
              value={servingsText}
              onChangeText={setServingsText}
              keyboardType="decimal-pad"
            />
            <Text variant="caption" tone="muted">
              {t('mealPlan.servingsEatenHint', { count: meal.servings })}
            </Text>
            <Button
              label={
                logging
                  ? t('mealPlan.logging')
                  : logAmount
                    ? t('mealPlan.logAmountCta', { count: logAmount })
                    : t('mealPlan.logToDiary')
              }
              onPress={() => {
                if (logAmount) void logNow(logAmount);
                else setError(t('mealPlan.errors.servingsRequired'));
              }}
              disabled={logging || !logAmount}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAdjusting(false);
                setServingsText(String(meal.servings));
                setError(null);
              }}
              hitSlop={6}
            >
              <Text variant="label" tone="brand">
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: spacing[2] }}>
            <Button
              label={
                logging
                  ? t('mealPlan.logging')
                  : t('mealPlan.logAmountCta', { count: meal.servings })
              }
              onPress={() => void logNow(plannedServings)}
              disabled={logging || !(plannedServings > 0)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mealPlan.adjustAmount')}
              onPress={() => {
                setAdjusting(true);
                setServingsText(String(meal.servings));
                setError(null);
              }}
              hitSlop={6}
            >
              <Text variant="caption" tone="secondary">
                {t('mealPlan.adjustAmount')}
              </Text>
            </Pressable>
          </View>
        )
      ) : (
        <>
          <Text variant="caption" tone="secondary">
            {t('mealPlan.loggedServingsLabel', {
              count: meal.logged_servings ?? 0,
            })}
          </Text>
          <Button
            label={t('mealPlan.editDiaryEntry')}
            variant="secondary"
            onPress={() => void openEdit()}
          />
        </>
      )}

      {error ? (
        <Text variant="bodySmall" tone="error">
          {error}
        </Text>
      ) : null}

      <FoodEntryEditModal
        entry={editingEntry}
        saving={updateEntry.isPending}
        deleting={deleteEntry.isPending}
        onClose={() => setEditingEntry(null)}
        onDelete={
          editingEntry
            ? async () => {
                try {
                  await deleteEntry.mutateAsync({
                    id: editingEntry.id,
                    dateKey: editingEntry.logged_on,
                  });
                  setEditingEntry(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : t('mealPlan.errors.logFailed'));
                }
              }
            : undefined
        }
        onSave={async (input) => {
          if (!editingEntry) return;
          await updateEntry.mutateAsync({
            id: editingEntry.id,
            dateKey: editingEntry.logged_on,
            ...input,
          });
          setEditingEntry(null);
        }}
      />
    </View>
  );
}
