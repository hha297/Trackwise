import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pencil, Trash2, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useLogFoodEntry } from '@/features/food/hooks';
import { NutritionMacrosRow } from '@/features/food/nutrition-macros-row';
import {
  parseFoodPickerIntent,
  parseMealType,
  type FoodPickerIntent,
} from '@/features/food/picker-intent';
import { parsePositiveAmount } from '@/features/food/scan-calculations';
import { FoodLogContextPicker } from '@/features/food/scan-result-modal';
import type { MealType } from '@/features/food/types';
import { usePlannedMealMutations } from '@/features/meal-plan/hooks';
import { sumRecipeMacrosFromRows } from '@/features/recipes/calculations';
import { useRecipe, useRecipeMutations } from '@/features/recipes/hooks';
import { IngredientThumbRow } from '@/features/recipes/ingredient-thumb-row';
import { recipeToLogFoodInput } from '@/features/recipes/log-to-diary';
import { RecipeEditor } from '@/features/recipes/recipe-editor';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { toDiaryDateKey } from '@/utils/date';

export default function RecipeDetailScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{
    id?: string;
    edit?: string;
    planDate?: string;
    meal?: string;
    intent?: string;
  }>();
  const recipeId = typeof params.id === 'string' ? params.id : undefined;
  const intent: FoodPickerIntent = parseFoodPickerIntent(params.intent);
  const initialDate =
    typeof params.planDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.planDate)
      ? params.planDate
      : toDiaryDateKey();
  const initialMeal = parseMealType(params.meal);

  const [editing, setEditing] = useState(params.edit === '1');
  const [servingsText, setServingsText] = useState('1');
  const [notes, setNotes] = useState('');
  const [dateKey, setDateKey] = useState(initialDate);
  const [mealType, setMealType] = useState<MealType>(initialMeal);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'log' | 'plan' | null>(null);
  const submitLock = useRef(false);

  const recipe = useRecipe(recipeId);
  const mutations = useRecipeMutations();
  const planMutations = usePlannedMealMutations();
  const logFood = useLogFoodEntry();

  if (!recipeId) {
    return (
      <Screen>
        <ErrorState title={t('recipes.loadError')} body={t('recipes.retry')} />
      </Screen>
    );
  }

  if (editing) {
    return <RecipeEditor recipeId={recipeId} />;
  }

  if (recipe.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (recipe.error || !recipe.data) {
    return (
      <Screen>
        <ErrorState
          title={t('recipes.loadError')}
          body={recipe.error instanceof Error ? recipe.error.message : t('recipes.retry')}
          onRetry={() => void recipe.refetch()}
        />
      </Screen>
    );
  }

  const data = recipe.data;
  const macros = sumRecipeMacrosFromRows(data.ingredients, data.servings);
  const servings = parsePositiveAmount(servingsText);
  const preview =
    servings && servings > 0
      ? {
          calories: macros.perServing.calories * servings,
          proteinG: macros.perServing.proteinG * servings,
          carbsG: macros.perServing.carbsG * servings,
          fatG: macros.perServing.fatG * servings,
        }
      : null;

  function confirmDelete() {
    Alert.alert(t('recipes.deleteTitle'), t('recipes.deleteBodyNamed', { name: data.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('recipes.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          if (mutations.remove.isPending) return;
          void mutations.remove.mutateAsync(recipeId!).then(() => router.back());
        },
      },
    ]);
  }

  async function addToMealPlan() {
    if (submitLock.current || busy) return;
    setActionError(null);
    if (!(servings && servings > 0)) {
      setActionError(t('mealPlan.errors.servingsRequired'));
      return;
    }
    submitLock.current = true;
    setBusy('plan');
    try {
      await planMutations.create.mutateAsync({
        planDate: dateKey,
        mealType,
        recipeId: data.id,
        title: data.name,
        notes: notes.trim() || null,
        servings,
        calories: macros.perServing.calories * servings,
        proteinG: macros.perServing.proteinG * servings,
        carbsG: macros.perServing.carbsG * servings,
        fatG: macros.perServing.fatG * servings,
      });
      router.replace({
        pathname: '/food/meal-plan',
        params: { date: dateKey, meal: mealType },
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('mealPlan.errors.saveFailed'));
    } finally {
      submitLock.current = false;
      setBusy(null);
    }
  }

  async function logToDiary() {
    if (submitLock.current || busy) return;
    setActionError(null);
    if (!(servings && servings > 0)) {
      setActionError(t('mealPlan.errors.servingsRequired'));
      return;
    }
    submitLock.current = true;
    setBusy('log');
    try {
      await logFood.mutateAsync(
        recipeToLogFoodInput({
          recipe: data,
          actualServings: servings,
          dateKey,
          mealType,
        }),
      );
      router.dismissTo({ pathname: '/', params: { date: dateKey } });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('food.add.logFailed'));
    } finally {
      submitLock.current = false;
      setBusy(null);
    }
  }

  const preferPlan = intent === 'plan';

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-start justify-between gap-3">
          <ChromeIconButton
            header
            label={t('common.close')}
            onPress={() => router.back()}
            icon={(color) => <X size={22} color={color} />}
          />
          <View className="flex-row items-center gap-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recipes.editCta')}
              onPress={() => setEditing(true)}
              hitSlop={8}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Pencil size={iconSizes.md} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recipes.deleteCta')}
              onPress={confirmDelete}
              disabled={mutations.remove.isPending}
              hitSlop={8}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.pill,
                backgroundColor: colors.errorMuted,
                opacity: mutations.remove.isPending ? 0.6 : 1,
              }}
            >
              <Trash2 size={iconSizes.md} color={colors.error} />
            </Pressable>
          </View>
        </View>

        {data.image_url ? (
          <Image
            source={{ uri: data.image_url }}
            style={{
              width: '100%',
              height: 180,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
            }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <Text variant="headingLarge" numberOfLines={3}>
          {data.name}
        </Text>

        {data.description ? (
          <Text variant="bodySmall" tone="secondary">
            {data.description}
          </Text>
        ) : null}

        <Card style={{ gap: spacing[2] }}>
          <Text variant="headingSmall">{t('recipes.nutrition')}</Text>
          <Text variant="caption" tone="muted">
            {t('recipes.servingsCount', { count: data.servings })}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('recipes.perServingKcal')}
          </Text>
          <NutritionMacrosRow
            showCalories
            calories={macros.perServing.calories}
            proteinG={macros.perServing.proteinG}
            carbsG={macros.perServing.carbsG}
            fatG={macros.perServing.fatG}
          />
          <Text variant="caption" tone="muted">
            {t('recipes.totalLine', { kcal: Math.round(macros.total.calories) })}
          </Text>
        </Card>

        <Card style={{ gap: spacing[1] }}>
          <Text variant="headingSmall">{t('recipes.ingredients')}</Text>
          {data.ingredients.length === 0 ? (
            <Text variant="bodySmall" tone="muted">
              {t('recipes.emptyIngredients')}
            </Text>
          ) : (
            data.ingredients.map((row, index) => (
              <IngredientThumbRow
                key={row.id}
                name={row.food_name}
                detail={t('recipes.ingredientAmount', {
                  amount: row.amount,
                  unit: t(`recipes.units.${row.amount_unit}`),
                })}
                imageUrl={row.image_url}
                showDivider={index < data.ingredients.length - 1}
              />
            ))
          )}
        </Card>

        {data.instructions ? (
          <Card style={{ gap: spacing[2] }}>
            <Text variant="headingSmall">{t('recipes.instructions')}</Text>
            <Text variant="bodySmall">{data.instructions}</Text>
          </Card>
        ) : null}

        <Card style={{ gap: spacing[3] }}>
          <Text variant="headingSmall">
            {preferPlan ? t('recipes.planActionTitle') : t('recipes.actionsTitle')}
          </Text>
          <Text variant="caption" tone="muted">
            {preferPlan ? t('recipes.planActionHint') : t('recipes.actionsHint')}
          </Text>
          <Input
            label={t('recipes.servings')}
            value={servingsText}
            onChangeText={setServingsText}
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
          {preferPlan ? (
            <Text variant="caption" tone="secondary">
              {t(`meals.${mealType}`)} · {dateKey}
            </Text>
          ) : (
            <FoodLogContextPicker
              dateKey={dateKey}
              mealType={mealType}
              onDate={setDateKey}
              onMeal={setMealType}
            />
          )}
          {preferPlan ? (
            <Input
              label={t('mealPlan.notes')}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          ) : null}
          {actionError ? (
            <Text variant="bodySmall" tone="error">
              {actionError}
            </Text>
          ) : null}

          {preferPlan ? (
            <Button
              label={busy === 'plan' ? t('mealPlan.saving') : t('recipes.addToPlanCta')}
              onPress={() => void addToMealPlan()}
              disabled={busy != null}
              loading={busy === 'plan'}
            />
          ) : (
            <>
              <Button
                label={busy === 'log' ? t('food.confirm.logging') : t('recipes.logToDiaryCta')}
                onPress={() => void logToDiary()}
                disabled={busy != null}
                loading={busy === 'log'}
              />
              <Button
                label={busy === 'plan' ? t('mealPlan.saving') : t('recipes.addToPlanCta')}
                variant="secondary"
                onPress={() => void addToMealPlan()}
                disabled={busy != null}
                loading={busy === 'plan'}
              />
            </>
          )}
        </Card>
      </View>
    </Screen>
  );
}
