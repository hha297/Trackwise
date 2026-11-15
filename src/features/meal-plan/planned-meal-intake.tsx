import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { FoodEntryEditModal } from '@/features/diary/components/food-entry-edit-modal';
import { useDeleteFoodEntry, useUpdateFoodEntryAmount } from '@/features/food/hooks';
import { NutritionMacrosRow } from '@/features/food/nutrition-macros-row';
import type { FoodEntry } from '@/features/food/types';
import {
  actualIntakeSummary,
  previewActualIntake,
  snapServings,
  type IntakePreview,
} from '@/features/meal-plan/intake-display';
import { usePlannedMealMutations } from '@/features/meal-plan/hooks';
import { PlannedMealAlreadyLoggedError } from '@/features/meal-plan/log-to-diary';
import { ServingsStepper } from '@/features/meal-plan/servings-stepper';
import type { PlannedMeal } from '@/features/meal-plan/types';
import { scalePlannedMacros } from '@/features/recipes/calculations';
import { getSupabase } from '@/lib/supabase/client';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type PlannedMealIntakeProps = {
  meal: PlannedMeal;
  onUpdateServings?: (nextServings: number, macros: ReturnType<typeof scalePlannedMacros>) => void;
};

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

/** Planned amount + actual intake controls for a Meal Plan Food/Recipe row. */
export function PlannedMealIntake({ meal, onUpdateServings }: PlannedMealIntakeProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const mutations = usePlannedMealMutations();
  const updateEntry = useUpdateFoodEntryAmount();
  const deleteEntry = useDeleteFoodEntry();

  const intake = actualIntakeSummary(meal);
  const [editingPlanned, setEditingPlanned] = useState(false);
  const [plannedDraft, setPlannedDraft] = useState(meal.servings);
  const [logOpen, setLogOpen] = useState(false);
  const [logDraft, setLogDraft] = useState(meal.servings);
  const [error, setError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);

  const logging = mutations.logToDiary.isPending;
  const logPreview = previewActualIntake(meal, logDraft);
  const plannedPreview = editingPlanned
    ? previewActualIntake(meal, plannedDraft)
    : null;

  function openPlannedEdit() {
    setPlannedDraft(meal.servings);
    setEditingPlanned(true);
    setLogOpen(false);
    setError(null);
  }

  function commitPlanned(next: number) {
    const snapped = snapServings(next);
    setPlannedDraft(snapped);
    if (!onUpdateServings || snapped === meal.servings) {
      setEditingPlanned(false);
      return;
    }
    const macros = scalePlannedMacros(
      {
        calories: meal.calories,
        proteinG: meal.protein_g,
        carbsG: meal.carbs_g,
        fatG: meal.fat_g,
      },
      meal.servings,
      snapped,
    );
    onUpdateServings(snapped, macros);
    setEditingPlanned(false);
  }

  function openLogPanel() {
    setEditingPlanned(false);
    setLogDraft(meal.servings);
    setLogOpen(true);
    setError(null);
  }

  function closeLogPanel() {
    setLogOpen(false);
    setLogDraft(meal.servings);
    setError(null);
  }

  async function confirmLog() {
    setError(null);
    const servings = snapServings(logDraft);
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
      setLogOpen(false);
    } catch (err) {
      if (err instanceof PlannedMealAlreadyLoggedError) {
        setError(t('mealPlan.errors.alreadyLogged'));
        return;
      }
      setError(err instanceof Error ? err.message : t('mealPlan.errors.logFailed'));
    }
  }

  async function openEditLog() {
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
    <View style={{ gap: spacing[3], width: '100%' }}>
      {/* Planned = intent quantity only (no kcal here — avoids twinning Actual). */}
      <View style={{ gap: spacing[2] }}>
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="caption" tone="secondary">
            {t('mealPlan.plannedAmount')}
          </Text>
          {onUpdateServings ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (editingPlanned) commitPlanned(plannedDraft);
                else openPlannedEdit();
              }}
              hitSlop={6}
            >
              <Text variant="caption" tone="brand">
                {editingPlanned ? t('common.done') : t('mealPlan.editAmount')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {editingPlanned ? (
          <View style={{ gap: spacing[2] }}>
            <ServingsStepper
              label={t('mealPlan.editServings')}
              value={plannedDraft}
              onChange={setPlannedDraft}
            />
            {plannedPreview ? (
              <MacroPreviewGrid preview={plannedPreview} title={t('mealPlan.nutritionPreview')} />
            ) : null}
          </View>
        ) : (
          <Text variant="body" tone="secondary">
            {t('mealPlan.servingsLabel', { count: meal.servings })}
          </Text>
        )}
      </View>

      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* Actual = diary outcome; kcal is primary when logged. */}
      <View style={{ gap: spacing[2] }}>
        <Text variant="caption" tone="secondary">
          {t('mealPlan.actualIntake')}
        </Text>

        {intake.status === 'planned' ? (
          logOpen ? (
            <View
              style={{
                gap: spacing[3],
                padding: spacing[3],
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                width: '100%',
              }}
            >
              <View style={{ gap: 4 }}>
                <Text variant="bodyStrong">{t('mealPlan.logActualIntake')}</Text>
                <Text variant="caption" tone="muted">
                  {t('mealPlan.logActualIntakeHint')}
                </Text>
              </View>

              <ServingsStepper
                label={t('mealPlan.servingsEaten')}
                value={logDraft}
                onChange={setLogDraft}
                disabled={logging}
              />

              {logPreview ? (
                <MacroPreviewGrid preview={logPreview} title={t('mealPlan.nutritionPreview')} />
              ) : null}

              <View className="flex-row items-center gap-3">
                <View style={{ flex: 1 }}>
                  <Button
                    label={t('common.cancel')}
                    variant="secondary"
                    fullWidth
                    disabled={logging}
                    onPress={closeLogPanel}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={logging ? t('mealPlan.logging') : t('mealPlan.confirmAndLog')}
                    fullWidth
                    loading={logging}
                    disabled={logging || !(logDraft > 0)}
                    onPress={() => void confirmLog()}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View
              className="flex-row items-center justify-between gap-3"
              style={{
                padding: spacing[3],
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text variant="body" className="min-w-0 flex-1" tone="muted">
                {t('mealPlan.notLoggedYet')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={openLogPanel}
                hitSlop={6}
                style={{
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radii.pill,
                  backgroundColor: colors.primary,
                }}
              >
                <Text variant="caption" style={{ color: colors.textOnPrimary }}>
                  {t('mealPlan.logToDiary')}
                </Text>
              </Pressable>
            </View>
          )
        ) : (
          <View style={{ gap: 4 }}>
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1 gap-0.5">
                <Text variant="bodyStrong" tone="brand" numberOfLines={1}>
                  {intake.calories != null
                    ? `${intake.calories} ${t('diary.meals.kcalUnit')}`
                    : t('mealPlan.actualLoggedSummary', {
                        count: intake.servings ?? 0,
                        kcal: 0,
                      })}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {t('mealPlan.loggedServingsLabel', { count: intake.servings ?? 0 })}
                  {intake.status === 'partial' ? ` · ${t('mealPlan.logStatus.partial')}` : ''}
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => void openEditLog()} hitSlop={6}>
                <Text variant="caption" tone="brand">
                  {t('mealPlan.editLog')}
                </Text>
              </Pressable>
            </View>
            {intake.status === 'partial' && intake.remainingServings != null ? (
              <Text variant="caption" tone="muted">
                {t('mealPlan.partialRemaining', { count: intake.remainingServings })}
              </Text>
            ) : null}
          </View>
        )}
      </View>

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

function MacroPreviewGrid({ preview, title }: { preview: IntakePreview; title: string }) {
  const { t } = useTranslation();

  return (
    <View style={{ gap: spacing[2], width: '100%' }}>
      <Text variant="caption" tone="secondary">
        {title}
      </Text>
      <NutritionMacrosRow
        compact
        onMutedSurface
        showCalories
        calories={preview.calories}
        proteinG={preview.proteinG}
        carbsG={preview.carbsG}
        fatG={preview.fatG}
      />
    </View>
  );
}
