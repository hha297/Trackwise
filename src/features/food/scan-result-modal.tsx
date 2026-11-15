import { Image } from 'expo-image';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  Beef,
  CalendarDays,
  Candy,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Flame,
  Leaf,
  PackageOpen,
  Waves,
  Wheat,
  X,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { formatDiaryHeading, parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

import type { MealType } from './types';
import type { TrackwiseFood, FoodLookupError, NutritionBasis } from './open-food-facts';
import { parsePositiveAmount, scaleNutritionForAmount } from './scan-calculations';

export type ScanModalResult =
  | { kind: 'loading'; barcode: string }
  | { kind: 'found'; barcode: string; food: TrackwiseFood }
  | { kind: 'not_found'; barcode: string }
  | { kind: 'error'; barcode: string; error: FoodLookupError }
  | { kind: 'unsupported'; barcode: string };

export type ScanSaveInput = {
  barcode: string;
  name: string;
  brand: string | null;
  source: 'manual' | 'open_food_facts';
  imageUrl: string | null;
  dateKey: string;
  mealType: MealType;
  amount: number;
  amountUnit: 'g' | 'ml' | 'serving';
  nutritionBasis: 'per100' | 'serving';
  basisUnit: 'g' | 'ml' | 'serving';
  basisAmount: number | null;
  nutritionUserEdited: boolean;
  servingLabel: string;
  servingGrams: number | null;
  totals: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    sugarsG: number | null;
    saturatedFatG: number | null;
    sodiumMg: number | null;
  };
};

export type ScanResultPurpose = 'diary' | 'recipe-ingredient';

type Props = {
  result: ScanModalResult | null;
  purpose?: ScanResultPurpose;
  initialDateKey: string;
  initialMealType: MealType | null;
  onClose: () => void;
  onRescan: () => void;
  onRetry: () => void;
  onSave: (input: ScanSaveInput) => Promise<void>;
};

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export function ScanResultModal({
  result,
  purpose = 'diary',
  initialDateKey,
  initialMealType,
  onClose,
  onRescan,
  onRetry,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const initialFood = result?.kind === 'found' ? result.food : null;
  const [manual, setManual] = useState(false);
  const [dateKey, setDateKey] = useState(initialDateKey);
  const [mealType, setMealType] = useState<MealType | null>(initialMealType);
  const [amount, setAmount] = useState(
    initialFood?.basis.kind === 'serving' ? (initialFood.basis.amount?.toString() ?? '100') : '100',
  );
  const [amountUnit, setAmountUnit] = useState<'g' | 'ml' | 'serving'>(
    initialFood?.basis.kind === 'serving'
      ? (initialFood.basis.unit ?? 'g')
      : (initialFood?.basis.unit ?? 'g'),
  );
  const [manualUnit, setManualUnit] = useState<'g' | 'ml'>('g');
  const [name, setName] = useState(initialFood?.name ?? '');
  const [brand, setBrand] = useState(initialFood?.brand ?? '');
  const [calories, setCalories] = useState(initialFood?.calories?.toString() ?? '');
  const [protein, setProtein] = useState(initialFood?.proteinG?.toString() ?? '');
  const [carbs, setCarbs] = useState(initialFood?.carbsG?.toString() ?? '');
  const [fat, setFat] = useState(initialFood?.fatG?.toString() ?? '');
  const [imageFailed, setImageFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const food = result?.kind === 'found' ? result.food : null;
  const basis: NutritionBasis = manual
    ? { kind: 'per100', unit: manualUnit }
    : (food?.basis ?? { kind: 'per100', unit: amountUnit === 'ml' ? 'ml' : 'g' });
  const parsedNutrition = {
    calories: parseNonNegative(calories),
    proteinG: parseNonNegative(protein),
    carbsG: parseNonNegative(carbs),
    fatG: parseNonNegative(fat),
    fiberG: manual ? null : (food?.fiberG ?? null),
    sugarsG: manual ? null : (food?.sugarsG ?? null),
    saturatedFatG: manual ? null : (food?.saturatedFatG ?? null),
    sodiumMg: manual ? null : (food?.sodiumMg ?? null),
    saltG: manual ? null : (food?.saltG ?? null),
  };
  const parsedAmount = parsePositiveAmount(amount);
  const totals = (() => {
    if (!parsedAmount) return null;
    try {
      return scaleNutritionForAmount(
        parsedNutrition,
        basis,
        parsedAmount,
        amountUnit,
        food?.serving ?? null,
      );
    } catch {
      return null;
    }
  })();
  const nutritionComplete = [parsedNutrition.calories, parsedNutrition.proteinG, parsedNutrition.carbsG, parsedNutrition.fatG].every(
    (value) => value !== null,
  );
  const nutritionUserEdited = manual;
  const forIngredient = purpose === 'recipe-ingredient';
  const canSave = Boolean(
    name.trim() &&
      (forIngredient || mealType) &&
      parsedAmount &&
      totals &&
      nutritionComplete &&
      !saving,
  );

  const enterManual = () => {
    setManual(true);
    setManualUnit('g');
    setAmountUnit('g');
    setAmount('100');
    setName(food?.name ?? '');
    setBrand(food?.brand ?? '');
    setCalories(food?.calories?.toString() ?? '');
    setProtein(food?.proteinG?.toString() ?? '');
    setCarbs(food?.carbsG?.toString() ?? '');
    setFat(food?.fatG?.toString() ?? '');
  };

  const save = async () => {
    if (!result || !parsedAmount || !totals || !nutritionComplete) return;
    if (!forIngredient && !mealType) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        barcode: result.barcode,
        name: name.trim(),
        brand: brand.trim() || null,
        source: manual ? 'manual' : 'open_food_facts',
        imageUrl: manual ? null : (food?.imageUrl ?? null),
        dateKey,
        mealType: mealType ?? 'snacks',
        amount: parsedAmount,
        amountUnit,
        nutritionBasis: basis.kind,
        basisUnit: basis.kind === 'per100' ? basis.unit : 'serving',
        basisAmount: basis.kind === 'per100' ? 100 : basis.amount,
        nutritionUserEdited,
        servingLabel:
          amountUnit === 'serving'
            ? `${formatNumber(parsedAmount)} × ${basis.kind === 'serving' ? basis.label : (food?.serving?.label ?? t('scan.serving'))}`
            : `${formatNumber(parsedAmount)} ${amountUnit}`,
        servingGrams: amountUnit === 'g' ? parsedAmount : null,
        totals: {
          calories: totals.calories!,
          proteinG: totals.proteinG!,
          carbsG: totals.carbsG!,
          fatG: totals.fatG!,
          fiberG: totals.fiberG ?? null,
          sugarsG: totals.sugarsG ?? null,
          saturatedFatG: totals.saturatedFatG ?? null,
          sodiumMg: totals.sodiumMg ?? null,
        },
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('scan.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={Boolean(result)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View className="flex-1">
              <Text variant="headingSmall">
                {manual ? t('scan.manualTitle') : t('scan.resultTitle')}
              </Text>
              {result?.barcode ? (
                <Text variant="caption" tone="secondary">
                  {result.barcode}
                </Text>
              ) : null}
            </View>
            <ChromeIconButton
              header
              label={t('scan.close')}
              onPress={onClose}
              icon={(color) => <X size={22} color={color} />}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {result?.kind === 'loading' ? <LoadingContent t={t} /> : null}
            {!manual && result?.kind === 'not_found' ? (
              <NotFoundContent
                barcode={result.barcode}
                t={t}
                onManual={enterManual}
                onRescan={onRescan}
                onClose={onClose}
              />
            ) : null}
            {!manual && result?.kind === 'unsupported' ? (
              <UnsupportedContent
                barcode={result.barcode}
                t={t}
                onRescan={onRescan}
                onClose={onClose}
              />
            ) : null}
            {!manual && result?.kind === 'error' ? (
              <ErrorContent
                t={t}
                error={result.error}
                onRetry={onRetry}
                onManual={enterManual}
                onClose={onClose}
              />
            ) : null}

            {(manual || food) && result?.kind !== 'loading' ? (
              <Animated.View
                key={manual ? 'manual-form' : 'scan-result'}
                entering={FadeInDown.duration(260)}
                style={styles.formStack}
              >
                {!manual && food ? (
                  <ProductHeader
                    food={food}
                    imageFailed={imageFailed}
                    onImageError={() => setImageFailed(true)}
                    t={t}
                  />
                ) : (
                  <Card className="gap-3">
                    <Input label={t('scan.foodName')} value={name} onChangeText={setName} />
                    <Input label={t('scan.brandOptional')} value={brand} onChangeText={setBrand} />
                    <Text variant="caption" tone="secondary">
                      {t('scan.manualPrivate')}
                    </Text>
                  </Card>
                )}

                {manual ? (
                  <Card className="gap-3">
                    <Text variant="headingSmall">{t('scan.nutritionBasis')}</Text>
                    <Segmented
                      options={[
                        { value: 'g', label: 'g' },
                        { value: 'ml', label: 'ml' },
                      ]}
                      value={manualUnit}
                      onChange={(unit) => {
                        setManualUnit(unit);
                        setAmountUnit(unit);
                      }}
                    />
                    <Text variant="bodySmall" tone="secondary">
                      {t('scan.per100', { unit: manualUnit })}
                    </Text>
                  </Card>
                ) : null}

                {manual ? (
                  <NutritionEditor
                    t={t}
                    basis={basis}
                    values={{ calories, protein, carbs, fat }}
                    onChange={{
                      calories: setCalories,
                      protein: setProtein,
                      carbs: setCarbs,
                      fat: setFat,
                    }}
                  />
                ) : food ? (
                  <NutritionDisplay t={t} food={food} />
                ) : null}

                <AmountCard
                  t={t}
                  basis={basis}
                  amount={amount}
                  amountUnit={amountUnit}
                  onAmount={setAmount}
                  onUnit={setAmountUnit}
                  totals={totals}
                />
                {forIngredient ? null : (
                  <FoodLogContextPicker
                    dateKey={dateKey}
                    mealType={mealType}
                    onDate={setDateKey}
                    onMeal={setMealType}
                  />
                )}

                {!nutritionComplete ? (
                  <Text variant="bodySmall" tone="error">
                    {t('scan.completeNutrition')}
                  </Text>
                ) : null}
                {saveError ? (
                  <Text variant="bodySmall" tone="error">
                    {saveError}
                  </Text>
                ) : null}
                <Button
                  label={
                    forIngredient
                      ? saving
                        ? t('recipes.addingIngredient')
                        : t('recipes.addIngredientCta')
                      : t('scan.saveLog')
                  }
                  size="lg"
                  disabled={!canSave}
                  loading={saving}
                  onPress={() => void save()}
                />
                <Button
                  label={t('scan.rescan')}
                  variant="secondary"
                  disabled={saving}
                  onPress={onRescan}
                />
                {!manual &&
                food &&
                (!food.name ||
                  [food.calories, food.proteinG, food.carbsG, food.fatG].some(
                    (value) => value === null,
                  )) ? (
                  <Button label={t('scan.enterManually')} variant="text" onPress={enterManual} />
                ) : null}
              </Animated.View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function ProductHeader({
  food,
  imageFailed,
  onImageError,
  t,
}: {
  food: TrackwiseFood;
  imageFailed: boolean;
  onImageError: () => void;
  t: T;
}) {
  const colors = useThemeColors();
  return (
    <Card className="gap-4">
      <View style={styles.productRow}>
        {food.imageUrl && !imageFailed ? (
          <Image
            source={{ uri: food.imageUrl }}
            style={styles.productImage}
            contentFit="cover"
            onError={onImageError}
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceMuted }]}>
            <PackageOpen size={34} color={colors.textMuted} />
            <Text variant="caption" tone="secondary">
              {t('scan.noImage')}
            </Text>
          </View>
        )}
        <View style={styles.productCopy}>
          <Text variant="headingSmall" numberOfLines={3} ellipsizeMode="tail">
            {food.name || t('scan.unnamedProduct')}
          </Text>
          {food.brand ? (
            <Text variant="bodySmall" tone="secondary" numberOfLines={2} ellipsizeMode="tail">
              {food.brand}
            </Text>
          ) : null}
          <Text variant="caption" tone="brand" numberOfLines={1}>
            {basisLabel(food.basis, t)}
          </Text>
        </View>
      </View>
      <ExtraNutritionChips
        t={t}
        fiberG={food.fiberG}
        sugarsG={food.sugarsG}
        saltG={food.saltG}
      />
    </Card>
  );
}

function NutritionEditor({
  t,
  basis,
  values,
  onChange,
}: {
  t: T;
  basis: NutritionBasis;
  values: Record<'calories' | 'protein' | 'carbs' | 'fat', string>;
  onChange: Record<'calories' | 'protein' | 'carbs' | 'fat', (value: string) => void>;
}) {
  const colors = useThemeColors();
  const fields = [
    {
      key: 'calories' as const,
      unit: 'kcal',
      color: colors.macroCalories,
      icon: <Flame size={20} color={colors.macroCalories} />,
    },
    {
      key: 'protein' as const,
      unit: 'g',
      color: colors.macroProtein,
      icon: <Beef size={20} color={colors.macroProtein} />,
    },
    {
      key: 'carbs' as const,
      unit: 'g',
      color: colors.macroCarbs,
      icon: <Wheat size={20} color={colors.macroCarbs} />,
    },
    {
      key: 'fat' as const,
      unit: 'g',
      color: colors.macroFat,
      icon: <Droplets size={20} color={colors.macroFat} />,
    },
  ];
  return (
    <Card className="gap-3">
      <View>
        <Text variant="headingSmall">{t('scan.nutrition')}</Text>
        <Text variant="bodySmall" tone="secondary">
          {basisLabel(basis, t)}
        </Text>
      </View>
      {fields.map(({ key, unit, color, icon }) => (
        <View
          key={key}
          style={[
            styles.nutritionField,
            { backgroundColor: colors.surfaceMuted, borderLeftColor: color, borderLeftWidth: 3 },
          ]}
        >
          <View style={styles.nutritionIcon}>
            {icon}
          </View>
          <View className="flex-1">
            <Input
              label={t(`scan.${key}`)}
              value={values[key]}
              onChangeText={onChange[key]}
              keyboardType="decimal-pad"
            />
          </View>
          <Text variant="bodySmall" tone="secondary">
            {unit}
          </Text>
        </View>
      ))}
    </Card>
  );
}

function NutritionDisplay({ t, food }: { t: T; food: TrackwiseFood }) {
  const colors = useThemeColors();
  const fields = [
    {
      key: 'calories',
      value: food.calories,
      unit: 'kcal',
      color: colors.macroCalories,
      icon: <Flame size={20} color={colors.macroCalories} />,
    },
    {
      key: 'protein',
      value: food.proteinG,
      unit: 'g',
      color: colors.macroProtein,
      icon: <Beef size={20} color={colors.macroProtein} />,
    },
    {
      key: 'carbs',
      value: food.carbsG,
      unit: 'g',
      color: colors.macroCarbs,
      icon: <Wheat size={20} color={colors.macroCarbs} />,
    },
    {
      key: 'fat',
      value: food.fatG,
      unit: 'g',
      color: colors.macroFat,
      icon: <Droplets size={20} color={colors.macroFat} />,
    },
  ] as const;

  return (
    <Card className="gap-3">
      <View>
        <Text variant="headingSmall">{t('scan.nutrition')}</Text>
        <Text variant="bodySmall" tone="secondary">
          {basisLabel(food.basis, t)}
        </Text>
      </View>
      <View style={styles.nutritionGrid}>
        {fields.map(({ key, value, unit, color, icon }) => (
          <View
            key={key}
            style={[
              styles.nutritionDisplayRow,
              { backgroundColor: colors.surfaceMuted, borderLeftColor: color, borderLeftWidth: 3 },
            ]}
          >
            <View style={styles.nutritionIcon}>
              {icon}
            </View>
            <Text variant="bodyStrong" style={styles.nutritionLabel}>
              {t(`scan.${key}`)}
            </Text>
            <Text variant="bodyStrong">
              {value === null ? '—' : `${formatNumber(value)} ${unit}`}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function AmountCard({
  t,
  basis,
  amount,
  amountUnit,
  onAmount,
  onUnit,
  totals,
}: {
  t: T;
  basis: NutritionBasis;
  amount: string;
  amountUnit: 'g' | 'ml' | 'serving';
  onAmount: (value: string) => void;
  onUnit: (value: 'g' | 'ml' | 'serving') => void;
  totals: ReturnType<typeof scaleNutritionForAmount> | null;
}) {
  const colors = useThemeColors();
  const options = [
    { value: 'g' as const, label: 'g' },
    { value: 'ml' as const, label: 'ml' },
  ];
  return (
    <Card className="gap-3">
      <View>
        <Text variant="headingSmall">{t('scan.amountConsumed')}</Text>
        <Text variant="bodySmall" tone="secondary">
          {amountUnit === 'serving'
            ? t('scan.servingCountHint')
            : t('scan.servingUnitHint', { unit: amountUnit })}
        </Text>
      </View>
      <Segmented
        options={options}
        value={amountUnit === 'serving' ? 'g' : amountUnit}
        onChange={onUnit}
      />
      <Input
        label={t('scan.servingSizeUnit', {
          unit: amountUnit === 'serving' ? 'g' : amountUnit,
        })}
        value={amount}
        onChangeText={onAmount}
        keyboardType="decimal-pad"
      />
      <Text variant="caption" tone="secondary">
        {t('scan.basisNotice', { basis: basisLabel(basis, t) })}
      </Text>
      <View style={styles.totalGrid}>
        <TotalCell
          icon={<Flame size={18} color={colors.macroCalories} />}
          color={colors.macroCalories}
          label={t('scan.calories')}
          value={totals?.calories ?? null}
          unit="kcal"
        />
        <TotalCell
          icon={<Beef size={18} color={colors.macroProtein} />}
          color={colors.macroProtein}
          label={t('scan.protein')}
          value={totals?.proteinG ?? null}
          unit="g"
        />
        <TotalCell
          icon={<Wheat size={18} color={colors.macroCarbs} />}
          color={colors.macroCarbs}
          label={t('scan.carbs')}
          value={totals?.carbsG ?? null}
          unit="g"
        />
        <TotalCell
          icon={<Droplets size={18} color={colors.macroFat} />}
          color={colors.macroFat}
          label={t('scan.fat')}
          value={totals?.fatG ?? null}
          unit="g"
        />
        {totals?.fiberG != null ? (
          <TotalCell
            icon={<Leaf size={18} color={colors.macroFiber} />}
            color={colors.macroFiber}
            label={t('scan.fiber')}
            value={totals.fiberG}
            unit="g"
          />
        ) : null}
        {totals?.sugarsG != null ? (
          <TotalCell
            icon={<Candy size={18} color={colors.macroSugars} />}
            color={colors.macroSugars}
            label={t('scan.sugars')}
            value={totals.sugarsG}
            unit="g"
          />
        ) : null}
        {totals?.saltG != null ? (
          <TotalCell
            icon={<Waves size={18} color={colors.macroSalt} />}
            color={colors.macroSalt}
            label={t('scan.salt')}
            value={totals.saltG}
            unit="g"
          />
        ) : null}
      </View>
    </Card>
  );
}

function ExtraNutritionChips({
  t,
  fiberG,
  sugarsG,
  saltG,
}: {
  t: T;
  fiberG: number | null;
  sugarsG: number | null;
  saltG: number | null;
}) {
  const colors = useThemeColors();
  const items = [
    fiberG != null
      ? {
          key: 'fiber',
          label: t('scan.fiber'),
          value: fiberG,
          color: colors.macroFiber,
          icon: <Leaf size={16} color={colors.macroFiber} strokeWidth={2.2} />,
        }
      : null,
    sugarsG != null
      ? {
          key: 'sugars',
          label: t('scan.sugars'),
          value: sugarsG,
          color: colors.macroSugars,
          icon: <Candy size={16} color={colors.macroSugars} strokeWidth={2.2} />,
        }
      : null,
    saltG != null
      ? {
          key: 'salt',
          label: t('scan.salt'),
          value: saltG,
          color: colors.macroSalt,
          icon: <Waves size={16} color={colors.macroSalt} strokeWidth={2.2} />,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    value: number;
    color: string;
    icon: ReactNode;
  }>;

  if (items.length === 0) return null;

  return (
    <View style={styles.extraGrid}>
      {items.map((item) => (
        <View
          key={item.key}
          style={[styles.extraChip, { backgroundColor: colors.surfaceMuted }]}
        >
          <View
            style={styles.extraIcon}
          >
            {item.icon}
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {item.label}
            </Text>
            <Text variant="bodySmall" numberOfLines={1}>
              {formatNumber(item.value)} g
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TotalCell({
  icon,
  color,
  label,
  value,
  unit,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  value: number | null;
  unit: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.totalCell,
        { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <View className="flex-row items-center gap-2">
        <View style={[styles.seriesMark, { backgroundColor: color }]} />
        <View style={styles.totalIcon}>
          {icon}
        </View>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      </View>
      <Text variant="bodyStrong">
        {value === null ? '—' : `${formatNumber(value)} ${unit}`}
      </Text>
    </View>
  );
}

export function FoodLogContextPicker({
  dateKey,
  mealType,
  onDate,
  onMeal,
}: {
  dateKey: string;
  mealType: MealType | null;
  onDate: (value: string) => void;
  onMeal: (value: MealType) => void;
}) {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const appLanguage = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];
  const locale =
    appLanguage === 'vi' || appLanguage === 'fi' || appLanguage === 'sv' ? appLanguage : 'en';
  const selectedDate = parseDiaryDateKey(dateKey);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(selectedDate));
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 }),
  });
  const weekdayLabels = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 }),
  }).map((day) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(day));

  const changeDate = (nextDate: Date) => {
    onDate(toDiaryDateKey(nextDate));
    setVisibleMonth(startOfMonth(nextDate));
  };

  return (
    <Card className="gap-3">
      <Text variant="headingSmall">{t('scan.logTo')}</Text>
      <View style={styles.dateRow}>
        <ChromeIconButton
          label={t('mealPlan.prevDay')}
          onPress={() => changeDate(addDays(selectedDate, -1))}
          icon={(color) => <ChevronLeft size={22} color={color} />}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setVisibleMonth(startOfMonth(selectedDate));
            setCalendarOpen((open) => !open);
          }}
          style={[
            styles.datePickerButton,
            { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          <CalendarDays size={19} color={colors.textOnPrimary} />
          <Text variant="bodyStrong" tone="onPrimary">
            {formatDiaryHeading(dateKey, locale)}
          </Text>
        </Pressable>
        <ChromeIconButton
          label={t('mealPlan.nextDay')}
          onPress={() => changeDate(addDays(selectedDate, 1))}
          icon={(color) => <ChevronRight size={22} color={color} />}
        />
      </View>
      {calendarOpen ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={[
            styles.calendar,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          ]}
        >
          <View style={styles.calendarHeader}>
            <ChromeIconButton
              label={t('mealPlan.prevDay')}
              onPress={() => setVisibleMonth((month) => addMonths(month, -1))}
              icon={(color) => <ChevronLeft size={22} color={color} />}
            />
            <Text variant="bodyStrong">
              {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
                visibleMonth,
              )}
            </Text>
            <ChromeIconButton
              label={t('mealPlan.nextDay')}
              onPress={() => setVisibleMonth((month) => addMonths(month, 1))}
              icon={(color) => <ChevronRight size={22} color={color} />}
            />
          </View>
          <View style={styles.calendarGrid}>
            {weekdayLabels.map((label, index) => (
              <Text
                key={`${label}-${index}`}
                variant="caption"
                tone="secondary"
                style={styles.calendarCell}
              >
                {label}
              </Text>
            ))}
            {calendarDays.map((day) => {
              const selected = isSameDay(day, selectedDate);
              return (
                <Pressable
                  key={toDiaryDateKey(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    changeDate(day);
                    setCalendarOpen(false);
                  }}
                  style={[styles.calendarDay, selected && { backgroundColor: colors.primary }]}
                >
                  <Text
                    variant="bodySmall"
                    style={{
                      color: selected
                        ? colors.textOnPrimary
                        : isSameMonth(day, visibleMonth)
                          ? colors.textPrimary
                          : colors.textMuted,
                    }}
                  >
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      ) : null}
      <View style={styles.mealGrid}>
        {mealTypes.map((meal) => (
          <Pressable
            key={meal}
            accessibilityRole="radio"
            accessibilityState={{ checked: mealType === meal }}
            onPress={() => onMeal(meal)}
            style={[
              styles.mealButton,
              {
                borderColor: 'transparent',
                borderWidth: 0,
                backgroundColor: mealType === meal ? colors.primary : colors.surfaceMuted,
              },
            ]}
          >
            <Text
              variant="bodySmall"
              tone={mealType === meal ? 'onPrimary' : 'secondary'}
            >
              {t(`meals.${meal}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      {!mealType ? (
        <Text variant="caption" tone="error">
          {t('scan.chooseMeal')}
        </Text>
      ) : null}
    </Card>
  );
}

function Segmented<TValue extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: TValue; label: string }[];
  value: string;
  onChange: (value: TValue) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[
            styles.segment,
            value === option.value && {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderWidth: 1,
            },
          ]}
        >
          <Text variant="bodyStrong" tone={value === option.value ? 'primary' : 'secondary'}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function LoadingContent({ t }: { t: T }) {
  return (
    <View style={styles.state}>
      <Text variant="headingSmall">{t('scan.lookingUp')}</Text>
      <Text variant="bodySmall" tone="secondary">
        {t('scan.lookingUpBody')}
      </Text>
    </View>
  );
}
function NotFoundContent({
  barcode,
  t,
  onManual,
  onRescan,
  onClose,
}: {
  barcode: string;
  t: T;
  onManual: () => void;
  onRescan: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.state}>
      <PackageOpen size={44} />
      <Text variant="headingLarge">{t('scan.notFoundTitle')}</Text>
      <Text variant="body" tone="secondary">
        {t('scan.notFoundBody')}
      </Text>
      <Text variant="bodyStrong">{barcode}</Text>
      <Button label={t('scan.enterManually')} onPress={onManual} />
      <Button label={t('scan.rescan')} variant="secondary" onPress={onRescan} />
      <Button label={t('scan.close')} variant="text" onPress={onClose} />
    </View>
  );
}
function UnsupportedContent({
  barcode,
  t,
  onRescan,
  onClose,
}: {
  barcode: string;
  t: T;
  onRescan: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.state}>
      <Text variant="headingLarge">{t('scan.unsupportedTitle')}</Text>
      <Text variant="body" tone="secondary">
        {t('scan.unsupportedBody')}
      </Text>
      <Text variant="bodyStrong">{barcode}</Text>
      <Button label={t('scan.rescan')} onPress={onRescan} />
      <Button label={t('scan.close')} variant="text" onPress={onClose} />
    </View>
  );
}
function ErrorContent({
  t,
  error,
  onRetry,
  onManual,
  onClose,
}: {
  t: T;
  error: FoodLookupError;
  onRetry: () => void;
  onManual: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.state}>
      <Text variant="headingLarge">{t('scan.lookupErrorTitle')}</Text>
      <Text variant="body" tone="secondary">
        {t(`scan.errors.${error.kind}`)}
      </Text>
      <Button label={t('scan.retry')} onPress={onRetry} />
      <Button label={t('scan.enterManually')} variant="secondary" onPress={onManual} />
      <Button label={t('scan.close')} variant="text" onPress={onClose} />
    </View>
  );
}

type T = (key: string, options?: Record<string, unknown>) => string;
function parseNonNegative(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
function basisLabel(basis: NutritionBasis, t: T) {
  return basis.kind === 'per100'
    ? t('scan.per100', { unit: basis.unit })
    : t('scan.perServing', { serving: basis.label });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: { padding: 16, paddingBottom: 32 },
  formStack: { gap: 16 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 48 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  productImage: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    flexGrow: 0,
    flexShrink: 0,
  },
  imagePlaceholder: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radii.md,
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 8,
  },
  productCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 6,
    paddingTop: 2,
  },
  segmented: { minHeight: 40, flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.pill },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  segmentActive: { borderWidth: 0 },
  totalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  totalCell: { width: '48%', gap: 6, borderWidth: 0, borderRadius: radii.md, padding: 10 },
  seriesMark: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: radii.pill,
  },
  totalIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  extraChip: {
    width: '31%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  extraIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 0,
    borderRadius: radii.md,
    padding: 8,
  },
  nutritionGrid: { gap: 8 },
  nutritionDisplayRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nutritionLabel: { flex: 1 },
  nutritionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  datePickerButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
  },
  calendar: { gap: 10, borderWidth: 0, borderRadius: radii.md, padding: 10 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.285%', textAlign: 'center' },
  calendarDay: {
    width: '13%',
    aspectRatio: 1,
    marginHorizontal: '0.642%',
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealButton: {
    width: '48%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  mealButtonActive: { borderWidth: 0 },
});
