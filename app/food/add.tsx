import { router, useLocalSearchParams } from 'expo-router';
import {
  Beef,
  ChevronLeft,
  Droplets,
  Flame,
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
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { FoodImageField } from '@/features/food/food-image-field';
import type { SelectedFoodImage } from '@/features/food/food-image';
import {
  FoodListRow,
  formatFoodNutritionDetail,
} from '@/features/food/food-list-row';
import {
  useCreateManualFood,
  useLogFoodEntry,
  useRecentFoods,
  useSearchFoods,
  type MealType,
} from '@/features/food/hooks';
import { FoodLogContextPicker } from '@/features/food/scan-result-modal';
import { uploadFoodImageToCloudinary } from '@/lib/cloudinary/upload';
import { iconSizes, radii, spacing, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { toDiaryDateKey } from '@/utils/date';

type AddMode = 'search' | 'manual';

export default function AddFoodScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ date?: string; meal?: string; mode?: string }>();
  const [dateKey, setDateKey] = useState(params.date ?? toDiaryDateKey());
  const [mealType, setMealType] = useState<MealType>(
    params.meal === 'breakfast' ||
      params.meal === 'lunch' ||
      params.meal === 'dinner' ||
      params.meal === 'snacks'
      ? params.meal
      : 'lunch',
  );
  const [mode, setMode] = useState<AddMode>(params.mode === 'manual' ? 'manual' : 'search');
  const [term, setTerm] = useState('');
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
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const search = useSearchFoods(term);
  const recent = useRecentFoods();
  const logFood = useLogFoodEntry();
  const createFood = useCreateManualFood();
  const loggingBusy = logFood.isPending;
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
      calories: values[0] * factor,
      protein: values[1] * factor,
      carbs: values[2] * factor,
      fat: values[3] * factor,
    };
  }, [calories, carbs, fat, manualUnit, protein, serving]);

  async function logExisting(
    food: {
      id?: string;
      name: string;
      brand?: string | null;
      serving_label: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      image_url?: string | null;
    },
    rowKey: string,
  ) {
    if (loggingBusy) return;
    setError(null);
    setAddingKey(rowKey);
    try {
      await logFood.mutateAsync({
        dateKey,
        mealType,
        quantity: 1,
        food: {
          id: food.id,
          name: food.name,
          brand: food.brand,
          servingLabel: food.serving_label,
          calories: food.calories,
          proteinG: food.protein_g,
          carbsG: food.carbs_g,
          fatG: food.fat_g,
          imageUrl: food.image_url ?? null,
        },
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('food.add.logFailed'));
    } finally {
      setAddingKey(null);
    }
  }

  function parseNutrition(value: string, label: string) {
    const parsed = Number(value.replace(',', '.'));
    if (!value.trim()) throw new Error(t('food.add.fieldRequired', { label }));
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(t('food.add.fieldNonNegative', { label }));
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

      const food = await createFood.mutateAsync({
        name: name.trim(),
        brand: brand.trim() || undefined,
        servingLabel: `${servingGrams} ${manualUnit}`,
        servingGrams: manualUnit === 'g' ? servingGrams : undefined,
        source: 'manual',
        nutritionBasis: 'per100',
        basisUnit: manualUnit,
        basisAmount: 100,
        nutritionUserEdited: true,
        imageUrl,
        calories: parseNutrition(calories, t('food.add.calories')) * factor,
        proteinG: parseNutrition(protein, t('food.add.protein')) * factor,
        carbsG: parseNutrition(carbs, t('food.add.carbs')) * factor,
        fatG: parseNutrition(fat, t('food.add.fat')) * factor,
      });
      await logFood.mutateAsync({
        dateKey,
        mealType,
        quantity: 1,
        amount: servingGrams,
        amountUnit: manualUnit,
        nutritionBasis: 'per100',
        basisAmount: 100,
        nutritionUserEdited: true,
        food: {
          id: food.id,
          name: food.name,
          brand: food.brand,
          servingLabel: food.serving_label,
          calories: food.calories,
          proteinG: food.protein_g,
          carbsG: food.carbs_g,
          fatG: food.fat_g,
        },
      });
      router.dismissTo({ pathname: '/', params: { date: dateKey } });
    } catch (err) {
      setUploadingImage(false);
      setError(err instanceof Error ? err.message : t('food.add.saveFailed'));
    }
  }

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-5">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.goBack')}
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <ChevronLeft color={colors.textPrimary} size={22} />
          </Pressable>
          <View className="flex-1">
            <Text variant="headingLarge">{t('food.add.title')}</Text>
            <Text variant="caption" tone="secondary">
              {t(`meals.${mealType}`)} · {dateKey}
            </Text>
          </View>
        </View>

        <View style={[styles.modeSwitch, { backgroundColor: colors.surfaceMuted }]}>
          <ModeButton
            active={mode === 'search'}
            icon={
              <Search
                size={18}
                color={mode === 'search' ? colors.textOnPrimary : colors.textSecondary}
              />
            }
            label={t('food.add.modeSearch')}
            onPress={() => {
              setError(null);
              setMode('search');
            }}
          />
          <ModeButton
            active={mode === 'manual'}
            icon={
              <Sparkles
                size={18}
                color={mode === 'manual' ? colors.textOnPrimary : colors.textSecondary}
              />
            }
            label={t('food.add.modeCreate')}
            onPress={() => {
              setError(null);
              setMode('manual');
            }}
          />
        </View>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.errorMuted }]}>
            <Text variant="bodySmall" tone="error">
              {error}
            </Text>
          </View>
        ) : null}

        {mode === 'manual' ? (
          <View className="gap-4">
            <View>
              <Text variant="headingSmall">{t('food.add.createTitle')}</Text>
              <Text variant="bodySmall" tone="secondary">
                {t('food.add.createSubtitle')}
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
                <Text variant="headingSmall">{t('food.add.nutritionPer100', { unit: manualUnit })}</Text>
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
              label={uploadingImage ? t('food.add.uploading') : t('food.add.saveAdd')}
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
            <Button
              label={t('food.add.scanBarcode')}
              variant="secondary"
              iconStart={(color) => <ScanLine color={color} size={20} />}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/scan',
                  params: { date: dateKey, meal: mealType, source: 'meal', nonce: Date.now() },
                })
              }
            />

            {term.trim().length >= 2 ? (
              search.isLoading ? (
                <LoadingState label={t('food.add.searching')} />
              ) : search.error ? (
                <ErrorState
                  title={t('food.add.searchFailed')}
                  body={search.error instanceof Error ? search.error.message : t('common.tryAgain')}
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
                      setMode('manual');
                    }}
                  />
                </Card>
              ) : (
                <View>
                  {results.map((food, index) => {
                    const key = food.id;
                    return (
                      <FoodListRow
                        key={key}
                        name={food.name}
                        brand={food.brand}
                        imageUrl={food.image_url}
                        detail={formatFoodNutritionDetail({ unavailableLabel: t('food.add.nutritionUnavailable'),
                          calories: food.calories,
                          servingLabel: food.serving_label,
                        })}
                        showDivider={index < results.length - 1}
                        disabled={loggingBusy && addingKey !== key}
                        loading={addingKey === key}
                        onPress={() => void logExisting(food, key)}
                      />
                    );
                  })}
                </View>
              )
            ) : recent.isLoading ? (
              <LoadingState label={t('food.add.loadingRecent')} />
            ) : (
              <RecentFoodsList
                entries={recent.data ?? []}
                addingKey={addingKey}
                loggingBusy={loggingBusy}
                onAdd={(entry) =>
                  void logExisting(
                    {
                      name: entry.food_name,
                      brand: entry.brand,
                      serving_label: entry.serving_label,
                      calories: entry.calories / Math.max(entry.quantity, 1),
                      protein_g: entry.protein_g / Math.max(entry.quantity, 1),
                      carbs_g: entry.carbs_g / Math.max(entry.quantity, 1),
                      fat_g: entry.fat_g / Math.max(entry.quantity, 1),
                      image_url: entry.image_url ?? null,
                    },
                    entry.id,
                  )
                }
              />
            )}
          </View>
        )}
      </View>
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
        variant="bodyStrong"
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
    <View style={[styles.macroField, { borderBottomColor: colors.border }]}>
      <View className="flex-row items-center gap-3">
        <View style={[styles.macroIcon, { backgroundColor: withAlpha(color, 0.09) }]}>{icon}</View>
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
        <SummaryMacro label={t('food.add.protein')} value={`${format(protein)} g`} />
        <SummaryMacro label={t('food.add.carbs')} value={`${format(carbs)} g`} />
        <SummaryMacro label={t('food.add.fat')} value={`${format(fat)} g`} />
      </View>
    </View>
  );
}

function SummaryMacro({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.summaryMacro,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]}
    >
      <View className="flex-row items-center gap-1.5">
        <View style={[styles.summaryDot, { backgroundColor: colors.primary }]} />
        <Text variant="caption" tone="secondary">
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
  addingKey,
  loggingBusy,
}: {
  entries: RecentEntry[];
  onAdd: (entry: RecentEntry) => void;
  addingKey: string | null;
  loggingBusy: boolean;
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
            detail={formatFoodNutritionDetail({ unavailableLabel: t('food.add.nutritionUnavailable'),
              calories: entry.calories,
              servingLabel: entry.serving_label,
            })}
            showDivider={index < entries.length - 1}
            disabled={loggingBusy && addingKey !== entry.id}
            loading={addingKey === entry.id}
            onPress={() => onAdd(entry)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  modeSwitch: { flexDirection: 'row', gap: 4, borderRadius: radii.pill, padding: 4 },
  modeButton: {
    minHeight: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
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
  summaryDot: { width: 7, height: 7, borderRadius: radii.sm },
  recentSection: {
    gap: spacing[1],
  },
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
  foodListEmptyCopy: {
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
