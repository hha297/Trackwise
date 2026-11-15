import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Flashlight, FlashlightOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SlideTransition } from '@/components/ui/slide-transition';
import { Text } from '@/components/ui/text';
import { useCreateManualFood, useLogFoodEntry, type MealType } from '@/features/food/hooks';
import {
  fetchOpenFoodFactsByBarcode,
  FoodLookupError,
  isSupportedProductBarcode,
} from '@/features/food/open-food-facts';
import { suggestedMealForDate } from '@/features/food/scan-calculations';
import {
  type ScanModalResult,
  ScanResultModal,
  type ScanSaveInput,
} from '@/features/food/scan-result-modal';
import { useRecipeIngredientScanStore } from '@/features/recipes/recipe-ingredient-scan-store';
import { brand, iconSizes, radii, spacing, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { toDiaryDateKey } from '@/utils/date';

const WHITE_OVERLAY = withAlpha(brand.white, 0.2);

export default function ScanScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    date?: string;
    meal?: string;
    source?: string;
    nonce?: string;
    sessionId?: string;
  }>();
  const recipeIngredientMode =
    params.source === 'recipe-ingredient' && typeof params.sessionId === 'string';
  const scanSessionId = typeof params.sessionId === 'string' ? params.sessionId : null;
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [result, setResult] = useState<ScanModalResult | null>(null);
  const [blockedBarcode, setBlockedBarcode] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const blockedCode = useRef<string | null>(null);
  const savedFood = useRef<{ barcode: string; id: string } | null>(null);
  const logRequestId = useRef(makeRequestId());
  const createFood = useCreateManualFood();
  const logFood = useLogFoodEntry();

  const today = toDiaryDateKey();
  const initialDateKey = params.source === 'meal' && params.date ? params.date : today;
  const initialMealType =
    params.source === 'meal' && isMealType(params.meal)
      ? params.meal
      : suggestedMealForDate(initialDateKey, today, new Date().getHours());

  const resetResult = useCallback((allowSameCode: boolean) => {
    requestSequence.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setResult(null);
    savedFood.current = null;
    logRequestId.current = makeRequestId();
    if (allowSameCode) {
      blockedCode.current = null;
      setBlockedBarcode(null);
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const timer = setTimeout(() => resetResult(true), 0);
    return () => clearTimeout(timer);
  }, [params.nonce, resetResult]);

  const lookup = useCallback(async (barcode: string) => {
    const sequence = ++requestSequence.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setResult({ kind: 'loading', barcode });
    try {
      const lookupResult = await fetchOpenFoodFactsByBarcode(barcode, {
        signal: controller.signal,
      });
      if (sequence !== requestSequence.current || controller.signal.aborted) return;
      setResult(
        lookupResult.status === 'found'
          ? { kind: 'found', barcode, food: lookupResult.food }
          : { kind: 'not_found', barcode },
      );
    } catch (error) {
      if (sequence !== requestSequence.current || controller.signal.aborted) return;
      const lookupError =
        error instanceof FoodLookupError
          ? error
          : new FoodLookupError('network', t('scan.errors.network'));
      setResult({ kind: 'error', barcode, error: lookupError });
    }
  }, [t]);

  const handleBarcode = useCallback(
    ({ data, type }: BarcodeScanningResult) => {
      if (result || blockedCode.current === data) return;
      blockedCode.current = data;
      setBlockedBarcode(data);
      if (!isSupportedProductBarcode(type, data)) {
        setResult({ kind: 'unsupported', barcode: data });
        return;
      }
      void lookup(data);
    },
    [lookup, result],
  );

  function leaveScanner() {
    if (recipeIngredientMode) {
      router.back();
      return;
    }
    router.replace('/');
  }

  async function saveScan(input: ScanSaveInput) {
    if (recipeIngredientMode && scanSessionId) {
      let calories = input.totals.calories;
      let proteinG = input.totals.proteinG;
      let carbsG = input.totals.carbsG;
      let fatG = input.totals.fatG;
      let servingLabel = input.servingLabel;
      let servingGrams = input.servingGrams;
      let nutritionBasis = input.nutritionBasis;
      let basisUnit = input.basisUnit;
      let basisAmount = input.basisAmount;
      if (
        input.nutritionBasis === 'per100' &&
        (input.amountUnit === 'g' || input.amountUnit === 'ml') &&
        input.amount > 0
      ) {
        const factor = input.amount / 100;
        calories = input.totals.calories / factor;
        proteinG = input.totals.proteinG / factor;
        carbsG = input.totals.carbsG / factor;
        fatG = input.totals.fatG / factor;
        servingLabel = `100 ${input.amountUnit}`;
        servingGrams = input.amountUnit === 'g' ? 100 : null;
        basisAmount = 100;
        basisUnit = input.amountUnit;
      }

      const created = await createFood.mutateAsync({
        name: input.name,
        brand: input.brand ?? undefined,
        barcode: input.barcode,
        source: input.source,
        imageUrl: input.imageUrl ?? undefined,
        servingLabel,
        servingGrams: servingGrams ?? undefined,
        nutritionBasis,
        basisUnit,
        basisAmount: basisAmount ?? undefined,
        nutritionUserEdited: input.nutritionUserEdited,
        calories,
        proteinG,
        carbsG,
        fatG,
      });

      useRecipeIngredientScanStore.getState().setPendingFood(scanSessionId, {
        id: created.id,
        name: created.name,
        brand: created.brand,
        barcode: created.barcode,
        serving_label: created.serving_label,
        serving_grams: created.serving_grams,
        calories: created.calories,
        protein_g: created.protein_g,
        carbs_g: created.carbs_g,
        fat_g: created.fat_g,
        source: created.source,
        image_url: created.image_url ?? input.imageUrl,
        nutrition_basis: created.nutrition_basis ?? nutritionBasis,
        basis_unit: created.basis_unit ?? basisUnit,
        basis_amount: created.basis_amount ?? basisAmount,
      });
      resetResult(false);
      router.back();
      return;
    }

    let foodId = savedFood.current?.barcode === input.barcode ? savedFood.current.id : null;
    if (!foodId) {
      const created = await createFood.mutateAsync({
        name: input.name,
        brand: input.brand ?? undefined,
        barcode: input.barcode,
        source: input.source,
        imageUrl: input.imageUrl ?? undefined,
        servingLabel: input.servingLabel,
        servingGrams: input.servingGrams ?? undefined,
        nutritionBasis: input.nutritionBasis,
        basisUnit: input.basisUnit,
        basisAmount: input.basisAmount ?? undefined,
        nutritionUserEdited: input.nutritionUserEdited,
        calories: input.totals.calories,
        proteinG: input.totals.proteinG,
        carbsG: input.totals.carbsG,
        fatG: input.totals.fatG,
      });
      foodId = created.id;
      savedFood.current = { barcode: input.barcode, id: foodId };
    }

    await logFood.mutateAsync({
      clientRequestId: logRequestId.current,
      entrySource: 'scanned_product',
      dateKey: input.dateKey,
      mealType: input.mealType,
      quantity: 1,
      amount: input.amount,
      amountUnit: input.amountUnit,
      nutritionBasis: input.nutritionBasis,
      basisAmount: input.basisAmount ?? undefined,
      basisUnit: input.basisUnit,
      nutritionUserEdited: input.nutritionUserEdited,
      food: {
        id: foodId,
        name: input.name,
        brand: input.brand,
        servingLabel: input.servingLabel,
        calories: input.totals.calories,
        proteinG: input.totals.proteinG,
        carbsG: input.totals.carbsG,
        fatG: input.totals.fatG,
        imageUrl: input.imageUrl,
        fiberG: input.totals.fiberG,
        sugarsG: input.totals.sugarsG,
        saturatedFatG: input.totals.saturatedFatG,
        sodiumMg: input.totals.sodiumMg,
      },
    });

    resetResult(false);
    router.replace({ pathname: '/', params: { date: input.dateKey } });
  }

  if (!permission) {
    return (
      <Screen slideFrom="bottom">
        <Text variant="body">{t('scan.checkingPermission')}</Text>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen slideFrom="bottom">
        <View className="flex-1 justify-center gap-4">
          <Text variant="headingLarge">{t('scan.cameraAccess')}</Text>
          <Text variant="body" tone="secondary">
            {t('scan.cameraAccessBody')}
          </Text>
          <Button label={t('scan.allowCamera')} onPress={() => void requestPermission()} />
          <Button label={t('scan.close')} variant="text" onPress={leaveScanner} />
        </View>
      </Screen>
    );
  }

  return (
    <SlideTransition from="bottom">
      <View className="flex-1 bg-black">
        <CameraView
          style={styles.flex}
          facing="back"
          enableTorch={torchEnabled}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14'] }}
          onBarcodeScanned={result ? undefined : handleBarcode}
        />
        <View style={[styles.topControls, { top: insets.top + spacing[3] }]}>
          <CameraControl
            label={t('scan.close')}
            onPress={leaveScanner}
            backgroundColor={colors.cameraOverlay}
            borderColor={colors.onOverlayBorder}
            activeBorderColor={brand.white}
            activeBackgroundColor={WHITE_OVERLAY}
          >
            <X color={brand.white} size={iconSizes.lg} strokeWidth={2.4} />
          </CameraControl>
          <CameraControl
            label={torchEnabled ? t('scan.flashOff') : t('scan.flashOn')}
            active={torchEnabled}
            onPress={() => setTorchEnabled((enabled) => !enabled)}
            backgroundColor={colors.cameraOverlay}
            borderColor={colors.onOverlayBorder}
            activeBorderColor={brand.white}
            activeBackgroundColor={WHITE_OVERLAY}
          >
            {torchEnabled ? (
              <FlashlightOff color={brand.white} size={iconSizes.lg - 2} strokeWidth={2.2} />
            ) : (
              <Flashlight color={brand.white} size={iconSizes.lg - 2} strokeWidth={2.2} />
            )}
          </CameraControl>
        </View>
        <ScanFrame accent={colors.primary} />
        <View style={[styles.instructions, { paddingBottom: insets.bottom + spacing[6] }]}>
          <Text variant="body" style={[styles.lightText, { color: colors.textOnOverlay }]}>
            {t('scan.align')}
          </Text>
          {recipeIngredientMode ? null : (
            <View style={styles.manualAction}>
              <Button
                label={t('scan.enterManually')}
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/food/add',
                    params: {
                      intent: 'log',
                      source: 'create',
                      date: initialDateKey,
                      meal: initialMealType ?? undefined,
                    },
                  })
                }
              />
            </View>
          )}
          {!result && blockedBarcode ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => resetResult(true)}
              style={[
                styles.rescanPill,
                {
                  backgroundColor: colors.cameraOverlay,
                  borderColor: brand.white,
                },
              ]}
            >
              <Text variant="bodyStrong" style={{ color: colors.textOnOverlay, textAlign: 'center' }}>
                {t('scan.rescan')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {result ? (
          <ScanResultModal
            key={`${result.kind}:${result.barcode}`}
            result={result}
            purpose={recipeIngredientMode ? 'recipe-ingredient' : 'diary'}
            initialDateKey={initialDateKey}
            initialMealType={initialMealType}
            onClose={() => resetResult(true)}
            onRescan={() => resetResult(true)}
            onRetry={() => void lookup(result.barcode)}
            onSave={saveScan}
          />
        ) : null}
      </View>
    </SlideTransition>
  );
}

function CameraControl({
  label,
  active,
  onPress,
  children,
  backgroundColor,
  borderColor,
  activeBorderColor,
  activeBackgroundColor,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  backgroundColor: string;
  borderColor: string;
  activeBorderColor: string;
  activeBackgroundColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cameraControl,
        {
          backgroundColor: active ? activeBackgroundColor : backgroundColor,
          borderColor: active ? activeBorderColor : borderColor,
        },
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

function ScanFrame({ accent }: { accent: string }) {
  return (
    <View pointerEvents="none" style={styles.scanFrame}>
      <View style={[styles.corner, styles.topLeft, { borderColor: accent }]} />
      <View style={[styles.corner, styles.topRight, { borderColor: accent }]} />
      <View style={[styles.corner, styles.bottomLeft, { borderColor: accent }]} />
      <View style={[styles.corner, styles.bottomRight, { borderColor: accent }]} />
    </View>
  );
}
function isMealType(value?: string): value is MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snacks';
}
function makeRequestId() {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topControls: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraControl: {
    width: spacing[12],
    height: spacing[12],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
  scanFrame: { position: 'absolute', top: '31%', left: spacing[8], right: spacing[8], height: 154 },
  corner: { position: 'absolute', width: 34, height: 34 },
  topLeft: {
    left: 0,
    top: 0,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: radii.xl + 2,
  },
  topRight: {
    right: 0,
    top: 0,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderTopRightRadius: radii.xl + 2,
  },
  bottomLeft: {
    left: 0,
    bottom: 0,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: radii.xl + 2,
  },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: radii.xl + 2,
  },
  instructions: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: 0,
    gap: 6,
    alignItems: 'center',
  },
  lightText: { textAlign: 'center' },
  manualAction: { width: '100%' },
  rescanPill: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
});
