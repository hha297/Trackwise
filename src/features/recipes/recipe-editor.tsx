import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Beef, Droplets, Flame, Plus, ScanLine, Trash2, Wheat } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import {
  FoodListRow,
  formatFoodNutritionDetail,
  formatFoodSourceLabel,
} from '@/features/food/food-list-row';
import {
  ensureSearchFoodRecord,
  useCreateManualFood,
  useSearchFoods,
  type Food,
} from '@/features/food/hooks';
import { parsePositiveAmount } from '@/features/food/scan-calculations';
import {
  parseFoodPickerIntent,
  parseMealType,
} from '@/features/food/picker-intent';
import {
  draftFromFood,
  normalizeIngredientAmountUnit,
  sumRecipeMacrosFromDrafts,
} from '@/features/recipes/calculations';
import { useRecipe, useRecipeMutations } from '@/features/recipes/hooks';
import { useRecipeIngredientScanStore } from '@/features/recipes/recipe-ingredient-scan-store';
import type { RecipeIngredientDraft, RecipeWithIngredients } from '@/features/recipes/types';
import { fonts } from '@/theme/fonts';
import { iconSizes, layout, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const AVATAR = 48;
const AMOUNT_UNITS: ('g' | 'ml')[] = ['g', 'ml'];

function newKey() {
  return `ing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function draftsFromRecipe(recipe: RecipeWithIngredients): RecipeIngredientDraft[] {
  return recipe.ingredients.map((row) => {
    const base: RecipeIngredientDraft = {
      key: row.id,
      foodId: row.food_id,
      foodName: row.food_name,
      brand: row.brand,
      imageUrl: row.image_url ?? null,
      amount: Number(row.amount),
      amountUnit: row.amount_unit,
      nutritionBasis: row.nutrition_basis,
      basisAmount: row.basis_amount,
      basisUnit: row.basis_unit,
      servingGrams: row.serving_grams,
      calories: Number(row.calories),
      proteinG: Number(row.protein_g),
      carbsG: Number(row.carbs_g),
      fatG: Number(row.fat_g),
    };
    return { ...base, ...normalizeIngredientAmountUnit(base) };
  });
}

type RecipeEditorProps = {
  recipeId?: string;
};

type PlanReturnParams = {
  intent?: string;
  planDate?: string;
  meal?: string;
};

export function RecipeEditor({ recipeId }: RecipeEditorProps) {
  const { t } = useTranslation();
  const existing = useRecipe(recipeId);
  const params = useLocalSearchParams<{
    intent?: string;
    planDate?: string;
    meal?: string;
  }>();
  const planReturn: PlanReturnParams = {
    intent: typeof params.intent === 'string' ? params.intent : undefined,
    planDate: typeof params.planDate === 'string' ? params.planDate : undefined,
    meal: typeof params.meal === 'string' ? params.meal : undefined,
  };

  if (recipeId && existing.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (recipeId && (existing.error || existing.data === null)) {
    return (
      <Screen>
        <ErrorState
          title={t('recipes.loadError')}
          body={existing.error instanceof Error ? existing.error.message : t('recipes.retry')}
          onRetry={() => void existing.refetch()}
        />
      </Screen>
    );
  }

  return (
    <RecipeEditorForm
      key={recipeId ?? 'new'}
      recipeId={recipeId}
      initial={existing.data ?? null}
      planReturn={planReturn}
    />
  );
}

function RecipeEditorForm({
  recipeId,
  initial,
  planReturn,
}: {
  recipeId?: string;
  initial: RecipeWithIngredients | null;
  planReturn?: PlanReturnParams;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const mutations = useRecipeMutations();
  const createFood = useCreateManualFood();
  const [sessionId] = useState(() => {
    const existing = useRecipeIngredientScanStore.getState().draft;
    if (
      existing &&
      ((recipeId && existing.recipeId === recipeId) ||
        (!recipeId && existing.recipeId == null))
    ) {
      return existing.sessionId;
    }
    return `recipe-edit-${recipeId ?? 'new'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });
  const savedDraft = useRecipeIngredientScanStore((s) =>
    s.draft?.sessionId === sessionId ? s.draft : null,
  );
  const [name, setName] = useState(savedDraft?.name ?? initial?.name ?? '');
  const [description, setDescription] = useState(
    savedDraft?.description ?? initial?.description ?? '',
  );
  const [instructions, setInstructions] = useState(
    savedDraft?.instructions ?? initial?.instructions ?? '',
  );
  const [servingsText, setServingsText] = useState(
    savedDraft?.servingsText ?? String(initial?.servings ?? 1),
  );
  const [ingredients, setIngredients] = useState<RecipeIngredientDraft[]>(
    savedDraft?.ingredients ?? (initial ? draftsFromRecipe(initial) : []),
  );
  const [search, setSearch] = useState(savedDraft?.search ?? '');
  const [addingFoodId, setAddingFoodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const foods = useSearchFoods(search);

  const servings = parsePositiveAmount(servingsText) ?? 0;
  const macros = useMemo(
    () => sumRecipeMacrosFromDrafts(ingredients, servings > 0 ? servings : 1),
    [ingredients, servings],
  );

  async function addFood(food: Food) {
    if (addingFoodId) return;
    setError(null);
    setAddingFoodId(food.id);
    try {
      const resolved = await ensureSearchFoodRecord(food, createFood.mutateAsync);
      const draft = draftFromFood({
        key: newKey(),
        foodId: resolved.id,
        name: resolved.name,
        brand: resolved.brand,
        calories: resolved.calories,
        proteinG: resolved.protein_g,
        carbsG: resolved.carbs_g,
        fatG: resolved.fat_g,
        servingGrams: resolved.serving_grams,
        imageUrl: resolved.image_url ?? food.image_url ?? null,
        servingLabel: resolved.serving_label,
        nutritionBasis: resolved.nutrition_basis,
        basisUnit: resolved.basis_unit,
        basisAmount: resolved.basis_amount,
      });
      setIngredients((current) => {
        const next = [...current, draft];
        const stored = useRecipeIngredientScanStore.getState().draft;
        if (stored?.sessionId === sessionId) {
          useRecipeIngredientScanStore.getState().beginScan({
            ...stored,
            ingredients: next,
            search: '',
          });
        }
        return next;
      });
      setSearch('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recipes.errors.saveFailed'));
    } finally {
      setAddingFoodId(null);
    }
  }

  useFocusEffect(
    useCallback(() => {
      const pending = useRecipeIngredientScanStore.getState().consumePendingFood(sessionId);
      if (pending) {
        void addFood(pending);
      }
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- add on focus only
    }, [sessionId]),
  );

  function openIngredientScan() {
    useRecipeIngredientScanStore.getState().beginScan({
      sessionId,
      recipeId,
      name,
      description,
      instructions,
      servingsText,
      ingredients,
      search,
    });
    router.push({
      pathname: '/(tabs)/scan',
      params: {
        source: 'recipe-ingredient',
        sessionId,
        nonce: String(Date.now()),
      },
    });
  }

  function updateIngredient(key: string, patch: Partial<RecipeIngredientDraft>) {
    setIngredients((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeIngredient(key: string) {
    setIngredients((current) => current.filter((row) => row.key !== key));
  }

  async function save() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('recipes.errors.nameRequired'));
      return;
    }
    if (!(servings > 0)) {
      setError(t('recipes.errors.servingsRequired'));
      return;
    }
    if (ingredients.length === 0) {
      setError(t('recipes.errors.ingredientsRequired'));
      return;
    }
    if (ingredients.some((row) => !(row.amount > 0))) {
      setError(t('recipes.errors.amountRequired'));
      return;
    }
    try {
      const payload = {
        name: trimmed,
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        servings,
        ingredients,
      };
      if (recipeId) {
        await mutations.update.mutateAsync({ recipeId, ...payload });
        useRecipeIngredientScanStore.getState().clearDraft(sessionId);
        router.back();
      } else {
        const id = await mutations.create.mutateAsync(payload);
        useRecipeIngredientScanStore.getState().clearDraft(sessionId);
        const planIntent = parseFoodPickerIntent(planReturn?.intent);
        const planDate =
          typeof planReturn?.planDate === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(planReturn.planDate)
            ? planReturn.planDate
            : undefined;
        router.replace({
          pathname: '/food/recipes/[id]',
          params: {
            id,
            ...(planIntent === 'plan' && planDate
              ? {
                  intent: 'plan',
                  planDate,
                  meal: parseMealType(planReturn?.meal),
                }
              : {}),
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recipes.errors.saveFailed'));
    }
  }

  const busy = mutations.create.isPending || mutations.update.isPending;

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {recipeId ? t('recipes.editTitle') : t('recipes.createTitle')}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text variant="bodyStrong" tone="brand">
              {t('common.close')}
            </Text>
          </Pressable>
        </View>

        <Card style={{ gap: spacing[3] }}>
          <Text variant="headingSmall">{t('recipes.ingredients')}</Text>
          <Input
            label={t('recipes.searchFoods')}
            value={search}
            onChangeText={setSearch}
            placeholder={t('recipes.searchPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            label={t('recipes.scanIngredient')}
            variant="secondary"
            iconStart={(color) => <ScanLine color={color} size={18} />}
            onPress={openIngredientScan}
            disabled={Boolean(addingFoodId)}
          />
          {search.trim().length >= 2 ? (
            foods.isSearching && !foods.data ? (
              <LoadingState />
            ) : foods.isError ? (
              <Text variant="bodySmall" tone="error">
                {foods.error instanceof Error ? foods.error.message : t('food.add.searchFailed')}
              </Text>
            ) : (
              <View style={{ gap: spacing[2] }}>
                {(foods.data ?? []).slice(0, 8).map((food) => (
                  <FoodListRow
                    key={food.id}
                    name={food.name}
                    brand={food.brand}
                    sourceLabel={formatFoodSourceLabel(food.source, t)}
                    detail={formatFoodNutritionDetail({
                      calories: food.calories,
                      servingLabel: food.serving_label,
                      unavailableLabel: t('recipes.nutritionUnavailable'),
                    })}
                    imageUrl={food.image_url}
                    onPress={() => void addFood(food)}
                    disabled={Boolean(addingFoodId)}
                    loading={addingFoodId === food.id}
                  />
                ))}
                {(foods.data ?? []).length === 0 ? (
                  <Text variant="bodySmall" tone="muted">
                    {t('recipes.noFoods')}
                  </Text>
                ) : null}
              </View>
            )
          ) : null}

          {ingredients.length === 0 ? (
            <Text variant="bodySmall" tone="muted">
              {t('recipes.emptyIngredients')}
            </Text>
          ) : (
            ingredients.map((row) => (
              <IngredientRow
                key={row.key}
                row={row}
                onChange={(patch) => updateIngredient(row.key, patch)}
                onRemove={() => removeIngredient(row.key)}
              />
            ))
          )}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Input label={t('recipes.name')} value={name} onChangeText={setName} autoCapitalize="sentences" />
          <Input
            label={t('recipes.description')}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Input
            label={t('recipes.servings')}
            value={servingsText}
            onChangeText={setServingsText}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('recipes.instructions')}
            value={instructions}
            onChangeText={setInstructions}
            multiline
          />
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <Text variant="headingSmall">{t('recipes.nutrition')}</Text>
          <Text variant="caption" tone="muted">
            {t('recipes.nutritionHint')}
          </Text>

          <View style={{ gap: spacing[2] }}>
            <Text variant="caption" tone="secondary">
              {t('recipes.totalKcal')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <MacroStat
                icon={(color) => <Flame size={16} color={color} />}
                color={colors.macroCalories}
                label={t('food.add.calories')}
                value={`${Math.round(macros.total.calories)} kcal`}
              />
              <MacroStat
                icon={(color) => <Beef size={16} color={color} />}
                color={colors.macroProtein}
                label={t('food.add.protein')}
                value={`${macros.total.proteinG} g`}
              />
              <MacroStat
                icon={(color) => <Wheat size={16} color={color} />}
                color={colors.macroCarbs}
                label={t('food.add.carbs')}
                value={`${macros.total.carbsG} g`}
              />
              <MacroStat
                icon={(color) => <Droplets size={16} color={color} />}
                color={colors.macroFat}
                label={t('food.add.fat')}
                value={`${macros.total.fatG} g`}
              />
            </View>
          </View>

          <View style={{ gap: spacing[2] }}>
            <Text variant="caption" tone="secondary">
              {t('recipes.perServingKcal')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <MacroStat
                icon={(color) => <Flame size={16} color={color} />}
                color={colors.macroCalories}
                label={t('food.add.calories')}
                value={`${Math.round(macros.perServing.calories)} kcal`}
              />
              <MacroStat
                icon={(color) => <Beef size={16} color={color} />}
                color={colors.macroProtein}
                label={t('food.add.protein')}
                value={`${macros.perServing.proteinG} g`}
              />
              <MacroStat
                icon={(color) => <Wheat size={16} color={color} />}
                color={colors.macroCarbs}
                label={t('food.add.carbs')}
                value={`${macros.perServing.carbsG} g`}
              />
              <MacroStat
                icon={(color) => <Droplets size={16} color={color} />}
                color={colors.macroFat}
                label={t('food.add.fat')}
                value={`${macros.perServing.fatG} g`}
              />
            </View>
          </View>

          {!macros.total.complete ? (
            <Text variant="caption" tone="muted">
              {t('recipes.nutritionIncomplete')}
            </Text>
          ) : null}
        </Card>

        {error ? (
          <Text variant="bodySmall" tone="error">
            {error}
          </Text>
        ) : null}

        <Button
          label={busy ? t('recipes.saving') : t('recipes.save')}
          onPress={() => void save()}
          disabled={busy}
          iconStart={(color) => <Plus size={16} color={color} />}
        />
      </View>
    </Screen>
  );
}

function IngredientRow({
  row,
  onChange,
  onRemove,
}: {
  row: RecipeIngredientDraft;
  onChange: (patch: Partial<RecipeIngredientDraft>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [amountText, setAmountText] = useState(String(row.amount));
  const [imageFailed, setImageFailed] = useState(false);

  const initial = (row.foodName.trim().charAt(0) || '?').toUpperCase();
  const showImage = Boolean(row.imageUrl) && !imageFailed;

  return (
    <View
      style={{
        gap: spacing[3],
        paddingVertical: spacing[3],
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
      }}
    >
      <View className="flex-row items-start gap-3">
        <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
          {showImage ? (
            <Image
              source={{ uri: row.imageUrl! }}
              style={styles.avatarImage}
              contentFit="cover"
              onError={() => setImageFailed(true)}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text style={[styles.avatarLetter, { color: colors.primary }]}>{initial}</Text>
          )}
        </View>

        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="bodyStrong" numberOfLines={2}>
            {row.foodName}
          </Text>
          {row.brand ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {row.brand}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('recipes.removeIngredient')}
          onPress={onRemove}
          hitSlop={8}
        >
          <Trash2 size={iconSizes.md} color={colors.error} />
        </Pressable>
      </View>

      <View className="flex-row items-end gap-3">
        <View className="min-w-0 flex-1">
          <Input
            label={t('recipes.amount')}
            value={amountText}
            onChangeText={(value) => {
              setAmountText(value);
              const parsed = parsePositiveAmount(value);
              if (parsed != null) onChange({ amount: parsed });
            }}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ width: 132, flexGrow: 0, flexShrink: 0 }}>
          <View style={{ gap: layout.labelGap }}>
            <Text variant="label" tone="secondary">
              {t('recipes.amountUnit')}
            </Text>
            <UnitSegmented
              value={row.amountUnit === 'ml' ? 'ml' : 'g'}
              onChange={(amountUnit) => onChange({ amountUnit })}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function UnitSegmented({
  value,
  onChange,
}: {
  value: 'g' | 'ml';
  onChange: (value: 'g' | 'ml') => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.segmented,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {AMOUNT_UNITS.map((unit) => {
        const active = value === unit;
        return (
          <Pressable
            key={unit}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(unit)}
            style={[
              styles.segment,
              active && {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.primary,
                borderWidth: 1,
              },
            ]}
          >
            <Text variant="bodyStrong" tone={active ? 'primary' : 'secondary'} numberOfLines={1}>
              {t(`recipes.units.${unit}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MacroStat({
  icon,
  color,
  label,
  value,
}: {
  icon: (color: string) => ReactNode;
  color: string;
  label: string;
  value: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.macroStat,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
      ]}
    >
      <View className="flex-row items-center gap-1.5">
        <View style={[styles.macroIcon, { backgroundColor: `${color}22` }]}>
          {icon(color)}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="bodyStrong" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexGrow: 0,
    flexShrink: 0,
  },
  avatarImage: {
    width: AVATAR,
    height: AVATAR,
  },
  avatarLetter: {
    fontFamily: fonts.ibmBold,
    fontSize: 18,
    lineHeight: 22,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
    minHeight: layout.inputMinHeight,
    alignItems: 'stretch',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    paddingHorizontal: spacing[1],
  },
  macroStat: {
    minWidth: '47%',
    flexGrow: 1,
    flexBasis: '47%',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  macroIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
