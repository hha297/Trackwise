import { router, useLocalSearchParams } from 'expo-router';
import {
  Beef,
  BookOpen,
  ChevronLeft,
  Droplets,
  Flame,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  Utensils,
  Wheat,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import {
  ConfirmSelectionModal,
  type ConfirmSelectionItem,
} from '@/features/food/confirm-selection-modal';
import { FoodImageField } from '@/features/food/food-image-field';
import type { SelectedFoodImage } from '@/features/food/food-image';
import {
  FoodListRow,
  formatFoodNutritionDetail,
  formatFoodSourceLabel,
} from '@/features/food/food-list-row';
import {
  ensureSearchFoodRecord,
  useCreateManualFood,
  useLogFoodEntry,
  useRecentFoods,
  useSearchFoods,
  type MealType,
} from '@/features/food/hooks';
import {
  parseFoodPickerIntent,
  parseFoodPickerSource,
  parseMealType,
  type FoodPickerIntent,
  type FoodPickerSource,
} from '@/features/food/picker-intent';
import { FoodLogContextPicker } from '@/features/food/scan-result-modal';
import { usePlannedMealMutations } from '@/features/meal-plan/hooks';
import { useRecipes } from '@/features/recipes/hooks';
import { uploadFoodImageToCloudinary } from '@/lib/cloudinary/upload';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { toDiaryDateKey } from '@/utils/date';

type PendingFood = ConfirmSelectionItem & {
  resolveId?: string;
  raw: {
    id?: string;
    name: string;
    brand?: string | null;
    barcode?: string | null;
    serving_label: string;
    serving_grams?: number | null;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    image_url?: string | null;
    source?: string;
  };
};

export default function AddFoodScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{
    date?: string;
    meal?: string;
    mode?: string;
    intent?: string;
    source?: string;
  }>();

  const intent: FoodPickerIntent = parseFoodPickerIntent(params.intent);
  const initialSource = parseFoodPickerSource(params.source ?? params.mode);
  /** Meal Plan Recipe entry opens recipes directly — no Foods/Create intermediate tabs. */
  const recipesOnly = initialSource === 'recipes';
  const [dateKey, setDateKey] = useState(params.date ?? toDiaryDateKey());
  const [mealType, setMealType] = useState<MealType>(parseMealType(params.meal));
  const [source, setSource] = useState<FoodPickerSource>(initialSource);

  const [term, setTerm] = useState('');
  const [recipeTerm, setRecipeTerm] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [serving, setServing] = useState('100');
  const [manualUnit, setManualUnit] = useState<'g' | 'ml'>('g');
  const [foodImage, setFoodImage] = useState<SelectedFoodImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pending, setPending] = useState<PendingFood | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);

  const search = useSearchFoods(term);
  const recent = useRecentFoods();
  const recipes = useRecipes(recipeTerm);
  const logFood = useLogFoodEntry();
  const createFood = useCreateManualFood();
  const planMutations = usePlannedMealMutations();

  const savingManual = uploadingImage || createFood.isPending || logFood.isPending;
  const results = useMemo(() => search.data ?? [], [search.data]);

  const summary = useMemo(() => {
    if (![serving, calories, protein, carbs, fat].every((value) => value.trim())) return null;
    const servingGrams = Number(serving.replace(',', '.'));
    const values = [calories, protein, carbs, fat].map((value) => Number(value.replace(',', '.')));
    if (
      !Number.isFinite(servingGrams) ||
      servingGrams <= 0 ||
      values.some((value) => !Number.isFinite(value) || value < 0)
    ) {
      return null;
    }
    const factor = servingGrams / 100;
    return {
      servingGrams,
      unit: manualUnit,
      calories: values[0]! * factor,
      protein: values[1]! * factor,
      carbs: values[2]! * factor,
      fat: values[3]! * factor,
    };
  }, [calories, carbs, fat, manualUnit, protein, serving]);

  function finishAfterWrite() {
    if (intent === 'plan') {
      router.replace({
        pathname: '/food/meal-plan',
        params: { date: dateKey, meal: mealType },
      });
      return;
    }
    router.dismissTo({ pathname: '/', params: { date: dateKey } });
  }

  function openFoodConfirm(food: PendingFood['raw']) {
    setError(null);
    setPending({
      name: food.name,
      brand: food.brand,
      perUnit: {
        calories: food.calories,
        proteinG: food.protein_g,
        carbsG: food.carbs_g,
        fatG: food.fat_g,
      },
      amountUnit: 'serving',
      defaultAmount: 1,
      servingHint: food.serving_label,
      resolveId: food.id,
      raw: food,
    });
  }

  async function confirmPending(input: {
    amount: number;
    amountUnit: 'g' | 'ml' | 'serving';
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    servingLabel: string;
  }) {
    if (!pending) return;
    setConfirmSaving(true);
    try {
      if (intent === 'plan') {
        await planMutations.create.mutateAsync({
          planDate: dateKey,
          mealType,
          recipeId: null,
          title: pending.name,
          notes: null,
          servings: input.amount,
          calories: input.calories,
          proteinG: input.proteinG,
          carbsG: input.carbsG,
          fatG: input.fatG,
        });
        setPending(null);
        finishAfterWrite();
        return;
      }

      const food = pending.raw;
      const resolved =
        food.id != null
          ? await ensureSearchFoodRecord(
              {
                id: food.id,
                name: food.name,
                brand: food.brand ?? null,
                barcode: food.barcode ?? null,
                serving_label: food.serving_label,
                serving_grams: food.serving_grams ?? null,
                calories: food.calories,
                protein_g: food.protein_g,
                carbs_g: food.carbs_g,
                fat_g: food.fat_g,
                source: food.source ?? 'manual',
                image_url: food.image_url ?? null,
              },
              createFood.mutateAsync,
            )
          : null;

      await logFood.mutateAsync({
        dateKey,
        mealType,
        quantity: 1,
        amount: input.amount,
        amountUnit: input.amountUnit,
        nutritionBasis: 'serving',
        basisAmount: 1,
        basisUnit: 'serving',
        food: {
          id: resolved?.id ?? food.id,
          name: resolved?.name ?? food.name,
          brand: resolved?.brand ?? food.brand,
          servingLabel: input.servingLabel,
          calories: input.calories,
          proteinG: input.proteinG,
          carbsG: input.carbsG,
          fatG: input.fatG,
          imageUrl: resolved?.image_url ?? food.image_url ?? null,
        },
      });
      setPending(null);
      finishAfterWrite();
    } finally {
      setConfirmSaving(false);
    }
  }

  function parseNutrition(value: string, label: string) {
    const parsed = Number(value.replace(',', '.'));
    if (!value.trim()) throw new Error(t('food.add.fieldRequired', { label }));
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(t('food.add.fieldNonNegative', { label }));
    }
    return parsed;
  }

  async function saveManual() {
    if (savingManual) return;
    setError(null);
    try {
      if (!name.trim()) throw new Error(t('food.add.nameRequired'));
      const servingGrams = parseNutrition(serving, t('food.add.servingA11y'));
      if (servingGrams <= 0) throw new Error(t('food.add.servingPositive'));
      const factor = servingGrams / 100;

      let imageUrl: string | undefined;
      if (foodImage) {
        setUploadingImage(true);
        try {
          const uploaded = await uploadFoodImageToCloudinary(foodImage);
          imageUrl = uploaded.secureUrl;
        } finally {
          setUploadingImage(false);
        }
      }

      const per100 = {
        calories: parseNutrition(calories, t('food.add.calories')),
        proteinG: parseNutrition(protein, t('food.add.protein')),
        carbsG: parseNutrition(carbs, t('food.add.carbs')),
        fatG: parseNutrition(fat, t('food.add.fat')),
      };
      const totals = {
        calories: per100.calories * factor,
        proteinG: per100.proteinG * factor,
        carbsG: per100.carbsG * factor,
        fatG: per100.fatG * factor,
      };

      if (intent === 'plan') {
        await planMutations.create.mutateAsync({
          planDate: dateKey,
          mealType,
          recipeId: null,
          title: name.trim(),
          notes: brand.trim() || null,
          servings: 1,
          calories: totals.calories,
          proteinG: totals.proteinG,
          carbsG: totals.carbsG,
          fatG: totals.fatG,
        });
        finishAfterWrite();
        return;
      }

      const created = await createFood.mutateAsync({
        name: name.trim(),
        brand: brand.trim() || undefined,
        source: 'manual',
        imageUrl,
        servingLabel: `${servingGrams} ${manualUnit}`,
        servingGrams: manualUnit === 'g' ? servingGrams : undefined,
        nutritionBasis: 'per100',
        basisUnit: manualUnit,
        basisAmount: 100,
        calories: totals.calories,
        proteinG: totals.proteinG,
        carbsG: totals.carbsG,
        fatG: totals.fatG,
      });

      await logFood.mutateAsync({
        dateKey,
        mealType,
        quantity: 1,
        amount: servingGrams,
        amountUnit: manualUnit,
        nutritionBasis: 'per100',
        basisAmount: 100,
        basisUnit: manualUnit,
        food: {
          id: created.id,
          name: created.name,
          brand: created.brand,
          servingLabel: `${servingGrams} ${manualUnit}`,
          calories: totals.calories,
          proteinG: totals.proteinG,
          carbsG: totals.carbsG,
          fatG: totals.fatG,
          imageUrl: created.image_url ?? imageUrl ?? null,
        },
      });
      finishAfterWrite();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('food.add.saveFailed'));
    }
  }

  const headerTitle = recipesOnly
    ? t('recipes.chooseTitle')
    : intent === 'plan'
      ? t('food.add.titlePlan', { meal: t(`meals.${mealType}`) })
      : t('food.add.titleLog', { meal: t(`meals.${mealType}`) });

  function openCreateRecipe() {
    router.push({
      pathname: '/food/recipes/new',
      params:
        intent === 'plan'
          ? { intent: 'plan', planDate: dateKey, meal: mealType }
          : {},
    });
  }

  const recipeRows = recipes.data ?? [];
  const recipeSearchEmpty =
    !recipes.isLoading &&
    !recipes.error &&
    recipeRows.length === 0 &&
    recipeTerm.trim().length > 0;
  const recipeLibraryEmpty =
    !recipes.isLoading && !recipes.error && recipeRows.length === 0 && !recipeTerm.trim();

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-5">
        <View className="flex-row items-start gap-3">
          <ChromeIconButton
            header
            label={t('common.goBack')}
            onPress={() => router.back()}
            icon={(color) => <ChevronLeft color={color} size={22} />}
          />
          <View className="flex-1">
            <Text variant="headingLarge">{headerTitle}</Text>
            <Text variant="caption" tone="secondary">
              {dateKey}
            </Text>
          </View>
        </View>

        {recipesOnly ? null : (
          <View style={[styles.modeSwitch, { backgroundColor: colors.surfaceMuted }]}>
            <ModeButton
              active={source === 'foods'}
              icon={
                <Search
                  size={18}
                  color={source === 'foods' ? colors.textOnPrimary : colors.textSecondary}
                />
              }
              label={t('food.add.modeFoods')}
              onPress={() => {
                setError(null);
                setSource('foods');
              }}
            />
            <ModeButton
              active={source === 'recipes'}
              icon={
                <BookOpen
                  size={18}
                  color={source === 'recipes' ? colors.textOnPrimary : colors.textSecondary}
                />
              }
              label={t('food.add.modeRecipes')}
              onPress={() => {
                setError(null);
                setSource('recipes');
              }}
            />
            <ModeButton
              active={source === 'create'}
              icon={
                <Sparkles
                  size={18}
                  color={source === 'create' ? colors.textOnPrimary : colors.textSecondary}
                />
              }
              label={t('food.add.modeCreate')}
              onPress={() => {
                setError(null);
                setSource('create');
              }}
            />
          </View>
        )}

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.errorMuted }]}>
            <Text variant="bodySmall" tone="error">
              {error}
            </Text>
          </View>
        ) : null}

        {source === 'recipes' ? (
          <View className="gap-4">
            <Button
              label={t('recipes.createCta')}
              variant="secondary"
              iconStart={(color) => <Plus size={16} color={color} />}
              onPress={openCreateRecipe}
            />
            <Input
              label={t('recipes.searchLibrary')}
              value={recipeTerm}
              onChangeText={setRecipeTerm}
              autoCapitalize="none"
              placeholder={t('recipes.searchLibraryPlaceholder')}
            />
            {recipes.isLoading ? <LoadingState /> : null}
            {recipes.error ? (
              <ErrorState
                title={t('recipes.loadError')}
                body={
                  recipes.error instanceof Error ? recipes.error.message : t('recipes.retry')
                }
                onRetry={() => void recipes.refetch()}
              />
            ) : null}
            {recipeLibraryEmpty ? (
              <Card className="gap-2 py-4">
                <Text variant="bodyStrong">{t('recipes.emptyTitle')}</Text>
                <Text variant="bodySmall" tone="secondary">
                  {t('recipes.emptyBody')}
                </Text>
              </Card>
            ) : null}
            {recipeSearchEmpty ? (
              <Card className="gap-2 py-4">
                <Text variant="bodyStrong">{t('recipes.searchEmptyTitle')}</Text>
                <Text variant="bodySmall" tone="secondary">
                  {t('recipes.searchEmptyBody')}
                </Text>
              </Card>
            ) : null}
            <View>
              {recipeRows.map((recipe, index) => (
                <FoodListRow
                  key={recipe.id}
                  name={recipe.name}
                  detail={t('recipes.servingsCount', { count: recipe.servings })}
                  imageUrl={recipe.image_url}
                  showDivider={index < recipeRows.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: '/food/recipes/[id]',
                      params: {
                        id: recipe.id,
                        intent,
                        planDate: dateKey,
                        meal: mealType,
                      },
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : source === 'create' ? (
          <View className="gap-4">
            <View>
              <Text variant="headingSmall">{t('food.add.createTitle')}</Text>
              <Text variant="bodySmall" tone="secondary">
                {intent === 'plan'
                  ? t('food.add.createSubtitlePlan')
                  : t('food.add.createSubtitle')}
              </Text>
            </View>

            <Card className="gap-4">
              <View>
                <Text variant="headingSmall">{t('food.add.detailsTitle')}</Text>
                <Text variant="caption" tone="secondary">
                  {t('food.add.detailsHint')}
                </Text>
              </View>
              <FoodImageField
                value={foodImage}
                onChange={setFoodImage}
                disabled={savingManual}
              />
              <Input
                label={t('food.add.nameLabel')}
                value={name}
                onChangeText={setName}
                placeholder={t('food.add.namePlaceholder')}
              />
              <Input
                label={t('food.add.brandLabel')}
                value={brand}
                onChangeText={setBrand}
                placeholder={t('food.add.brandPlaceholder')}
              />
              <UnitSwitch value={manualUnit} onChange={setManualUnit} />
              <ServingField unit={manualUnit} value={serving} onChangeText={setServing} />
            </Card>

            <Card className="gap-4">
              <View>
                <Text variant="headingSmall">
                  {t('food.add.nutritionPer100', { unit: manualUnit })}
                </Text>
                <Text variant="bodySmall" tone="secondary">
                  {t('food.add.nutritionHint')}
                </Text>
              </View>
              <MacroField
                color={colors.macroCalories}
                icon={<Flame color={colors.macroCalories} size={20} />}
                label={t('food.add.calories')}
                unit="kcal"
                value={calories}
                onChangeText={setCalories}
              />
              <MacroField
                color={colors.macroProtein}
                icon={<Beef color={colors.macroProtein} size={20} />}
                label={t('food.add.protein')}
                unit="g"
                value={protein}
                onChangeText={setProtein}
              />
              <MacroField
                color={colors.macroCarbs}
                icon={<Wheat color={colors.macroCarbs} size={20} />}
                label={t('food.add.carbs')}
                unit="g"
                value={carbs}
                onChangeText={setCarbs}
              />
              <MacroField
                color={colors.macroFat}
                icon={<Droplets color={colors.macroFat} size={19} />}
                label={t('food.add.fat')}
                unit="g"
                value={fat}
                onChangeText={setFat}
              />
            </Card>

            {summary ? <NutritionSummary {...summary} /> : null}

            <FoodLogContextPicker
              dateKey={dateKey}
              mealType={mealType}
              onDate={setDateKey}
              onMeal={setMealType}
            />

            <Button
              label={
                uploadingImage
                  ? t('food.add.uploading')
                  : intent === 'plan'
                    ? t('food.confirm.addToPlan')
                    : t('food.add.saveAdd')
              }
              size="lg"
              disabled={!name.trim() || savingManual}
              loading={savingManual}
              onPress={() => void saveManual()}
            />
          </View>
        ) : (
          <View className="gap-4">
            <Input
              label={t('food.add.searchLabel')}
              value={term}
              onChangeText={setTerm}
              autoCapitalize="none"
              placeholder={t('food.add.searchPlaceholder')}
            />
            {intent === 'log' ? (
              <Button
                label={t('food.add.scanBarcode')}
                variant="secondary"
                iconStart={(color) => <ScanLine color={color} size={20} />}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/scan',
                    params: {
                      date: dateKey,
                      meal: mealType,
                      source: 'meal',
                      nonce: String(Date.now()),
                    },
                  })
                }
              />
            ) : null}

            {term.trim().length >= 2 ? (
              search.isSearching && !search.data ? (
                <LoadingState label={t('food.add.searching')} />
              ) : search.error ? (
                <ErrorState
                  title={t('food.add.searchFailed')}
                  body={
                    search.error instanceof Error ? search.error.message : t('common.tryAgain')
                  }
                  onRetry={() => void search.refetch()}
                />
              ) : results.length === 0 ? (
                <Card className="items-center gap-3 py-6">
                  <Search color={colors.textMuted} size={28} />
                  <View className="items-center">
                    <Text variant="bodyStrong">{t('food.add.noFoodsTitle')}</Text>
                    <Text variant="bodySmall" tone="secondary">
                      {t('food.add.noFoodsBody')}
                    </Text>
                  </View>
                  <Button
                    label={t('food.add.createThisFood')}
                    variant="text"
                    onPress={() => {
                      setName(term.trim());
                      setSource('create');
                    }}
                  />
                </Card>
              ) : (
                <View>
                  {results.map((food, index) => (
                    <FoodListRow
                      key={food.id}
                      name={food.name}
                      brand={food.brand}
                      imageUrl={food.image_url}
                      sourceLabel={formatFoodSourceLabel(food.source, t)}
                      detail={formatFoodNutritionDetail({
                        unavailableLabel: t('food.add.nutritionUnavailable'),
                        calories: food.calories,
                        servingLabel: food.serving_label,
                      })}
                      showDivider={index < results.length - 1}
                      onPress={() => openFoodConfirm(food)}
                    />
                  ))}
                </View>
              )
            ) : recent.isLoading ? (
              <LoadingState label={t('food.add.loadingRecent')} />
            ) : (
              <RecentFoodsList
                entries={recent.data ?? []}
                onAdd={(entry) =>
                  openFoodConfirm({
                    name: entry.food_name,
                    brand: entry.brand,
                    serving_label: entry.serving_label,
                    calories: entry.calories / Math.max(entry.quantity, 1),
                    protein_g: entry.protein_g / Math.max(entry.quantity, 1),
                    carbs_g: entry.carbs_g / Math.max(entry.quantity, 1),
                    fat_g: entry.fat_g / Math.max(entry.quantity, 1),
                    image_url: entry.image_url ?? null,
                  })
                }
              />
            )}
          </View>
        )}
      </View>

      <ConfirmSelectionModal
        item={pending}
        intent={intent}
        dateKey={dateKey}
        mealType={mealType}
        saving={confirmSaving}
        onClose={() => setPending(null)}
        onDate={setDateKey}
        onMeal={setMealType}
        onConfirm={confirmPending}
      />
    </Screen>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeButton, active && { backgroundColor: colors.primary }]}
    >
      {icon}
      <Text
        variant="caption"
        numberOfLines={1}
        style={{ color: active ? colors.textOnPrimary : colors.textSecondary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function UnitSwitch({
  value,
  onChange,
}: {
  value: 'g' | 'ml';
  onChange: (value: 'g' | 'ml') => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.unitSwitch, { backgroundColor: colors.surfaceMuted }]}>
      {(['g', 'ml'] as const).map((unit) => (
        <Pressable
          key={unit}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === unit }}
          onPress={() => onChange(unit)}
          style={[
            styles.unitOption,
            value === unit && {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
            },
          ]}
        >
          <Text variant="bodyStrong" tone={value === unit ? 'primary' : 'secondary'}>
            {unit}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ServingField({
  unit,
  value,
  onChangeText,
}: {
  unit: 'g' | 'ml';
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View className="gap-1.5">
      <Text variant="label" tone="secondary">
        {t('food.add.amountConsumed', { unit })}
      </Text>
      <View
        style={[
          styles.servingField,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <TextInput
          accessibilityLabel={t('food.add.servingA11y')}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="100"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          style={[styles.servingInput, { color: colors.textPrimary }]}
        />
      </View>
    </View>
  );
}

function MacroField({
  color,
  icon,
  label,
  unit,
  value,
  onChangeText,
}: {
  color: string;
  icon: ReactNode;
  label: string;
  unit: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.macroField,
        { borderBottomColor: colors.border, borderLeftColor: color, borderLeftWidth: 3 },
      ]}
    >
      <View className="flex-row items-center gap-3">
        <View style={styles.macroIcon}>{icon}</View>
        <Text variant="bodyStrong">{label}</Text>
      </View>
      <View style={styles.macroValue}>
        <View style={[styles.macroInputWrap, { backgroundColor: colors.surfaceMuted }]}>
          <TextInput
            accessibilityLabel={`${label} in ${unit}`}
            value={value}
            onChangeText={onChangeText}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            style={[styles.macroInput, { color: colors.textPrimary }]}
          />
        </View>
        <Text variant="bodySmall" tone="secondary" style={styles.macroUnit}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

function NutritionSummary({
  servingGrams,
  unit,
  calories,
  protein,
  carbs,
  fat,
}: {
  servingGrams: number;
  unit: 'g' | 'ml';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const format = (value: number) => (value < 10 ? value.toFixed(1) : Math.round(value).toString());

  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: colors.surface, borderColor: colors.borderStrong },
      ]}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="headingSmall">{t('food.add.summaryTitle')}</Text>
        <View
          style={[
            styles.summaryServingBadge,
            { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
          ]}
        >
          <Text variant="bodyStrong" tone="primary">
            {format(servingGrams)} {unit}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.summaryCaloriesRow,
          { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
        ]}
      >
        <View>
          <Text variant="caption" tone="primary">
            {t('food.add.totalEnergy')}
          </Text>
          <View className="flex-row items-end gap-2">
            <Text style={[styles.summaryCalories, { color: colors.textPrimary }]}>
              {format(calories)}
            </Text>
            <Text variant="bodyStrong" tone="secondary" style={styles.summaryCaloriesUnit}>
              kcal
            </Text>
          </View>
        </View>
        <Flame color={colors.primary} size={28} strokeWidth={2.2} />
      </View>
      <View className="flex-row gap-2">
        <SummaryMacro
          label={t('food.add.protein')}
          value={`${format(protein)} g`}
          color={colors.macroProtein}
          icon={<Beef color={colors.macroProtein} size={16} />}
        />
        <SummaryMacro
          label={t('food.add.carbs')}
          value={`${format(carbs)} g`}
          color={colors.macroCarbs}
          icon={<Wheat color={colors.macroCarbs} size={16} />}
        />
        <SummaryMacro
          label={t('food.add.fat')}
          value={`${format(fat)} g`}
          color={colors.macroFat}
          icon={<Droplets color={colors.macroFat} size={16} />}
        />
      </View>
    </View>
  );
}

function SummaryMacro({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.summaryMacro,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          borderLeftColor: color,
          borderLeftWidth: 3,
        },
      ]}
    >
      <View className="flex-row items-center gap-1.5">
        <View style={styles.summaryIcon}>
          {icon}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="bodyStrong" style={{ color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}

type RecentEntry = {
  id: string;
  food_name: string;
  brand?: string | null;
  serving_label: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  quantity: number;
  image_url?: string | null;
};

function RecentFoodsList({
  entries,
  onAdd,
}: {
  entries: RecentEntry[];
  onAdd: (entry: RecentEntry) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  if (entries.length === 0) {
    return (
      <View style={styles.foodListEmpty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
          <Utensils size={iconSizes.md} color={colors.textMuted} strokeWidth={2} />
        </View>
        <Text variant="bodyStrong">{t('food.add.noRecentTitle')}</Text>
        <Text variant="bodySmall" tone="secondary" style={styles.foodListEmptyCopy}>
          {t('food.add.noRecentBody')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.recentSection}>
      <View style={styles.recentHeader}>
        <Text variant="label" tone="secondary">
          {t('food.add.recentTitle')}
        </Text>
        <Text variant="caption" tone="muted">
          {entries.length}
        </Text>
      </View>
      <View>
        {entries.map((entry, index) => (
          <FoodListRow
            key={entry.id}
            name={entry.food_name}
            brand={entry.brand}
            imageUrl={entry.image_url}
            detail={formatFoodNutritionDetail({
              unavailableLabel: t('food.add.nutritionUnavailable'),
              calories: entry.calories,
              servingLabel: entry.serving_label,
            })}
            showDivider={index < entries.length - 1}
            onPress={() => onAdd(entry)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modeSwitch: { flexDirection: 'row', gap: 4, borderRadius: radii.pill, padding: 4 },
  modeButton: {
    minHeight: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
  },
  errorBanner: { borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12 },
  unitSwitch: { minHeight: 48, flexDirection: 'row', gap: 4, borderRadius: radii.pill, padding: 4 },
  unitOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radii.pill,
  },
  servingField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
  },
  servingInput: { minHeight: 48, flex: 1, fontSize: 16, lineHeight: 22, textAlign: 'left' },
  macroField: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  macroIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  macroInput: {
    minHeight: 40,
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'right',
  },
  macroInputWrap: { width: 104, borderRadius: radii.md, overflow: 'hidden' },
  macroValue: {
    width: 148,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  macroUnit: { width: 34, textAlign: 'right' },
  summaryCard: { gap: 12, borderWidth: 0, borderRadius: radii.md, padding: 16 },
  summaryServingBadge: {
    borderWidth: 0,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  summaryCaloriesRow: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryCalories: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  summaryCaloriesUnit: { paddingBottom: 5 },
  summaryMacro: { flex: 1, gap: 4, borderWidth: 0, borderRadius: radii.md, padding: 10 },
  summaryIcon: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSection: { gap: spacing[1] },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
    marginBottom: spacing[1],
  },
  foodListEmpty: {
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[8],
  },
  foodListEmptyCopy: { textAlign: 'center', maxWidth: 260 },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
