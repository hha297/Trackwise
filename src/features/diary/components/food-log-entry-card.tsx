import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Image as RNImage, Pressable, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import type { FoodEntry } from '@/features/food/types';
import { radii, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

/** Smaller than meal header (48) so entries nest visually under the meal. */
const THUMB = 40;

type FoodLogEntryCardProps = {
  entry: FoodEntry;
  mealImage: ImageSourcePropType;
  onEdit?: () => void;
};

function formatMacro(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded =
    digits === 0 ? Math.round(value) : Math.round(value * 10 ** digits) / 10 ** digits;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
}

function quantityLabel(entry: FoodEntry) {
  if (entry.amount != null && entry.amount_unit) {
    if (entry.amount_unit === 'g' || entry.amount_unit === 'ml') {
      return `${formatMacro(entry.amount, 1) ?? entry.amount} ${entry.amount_unit}`;
    }
    return `${formatMacro(entry.amount, 1) ?? entry.amount} × ${entry.serving_label}`;
  }
  return `${entry.quantity} × ${entry.serving_label}`;
}

export function FoodLogEntryCard({ entry, mealImage, onEdit }: FoodLogEntryCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);
  const showProductImage = Boolean(entry.image_url) && !imageFailed;
  const isScannedProduct = Boolean(entry.image_url) || entry.nutrition_basis != null;

  const subtitle = useMemo(() => {
    const qty = quantityLabel(entry);
    if (isScannedProduct) {
      return `${t('diary.meals.scannedProduct')} · ${qty}`;
    }
    if (entry.brand?.trim()) {
      return `${entry.brand.trim()} · ${qty}`;
    }
    return qty;
  }, [entry, isScannedProduct, t]);

  const protein = formatMacro(entry.protein_g, 1);
  const carbs = formatMacro(entry.carbs_g, 1);
  const fat = formatMacro(entry.fat_g, 1);
  const fiber = formatMacro(entry.fiber_g, 1);
  const sugars = formatMacro(entry.sugars_g, 1);
  const satFat = formatMacro(entry.saturated_fat_g, 1);
  const sodium = formatMacro(entry.sodium_mg, 0);

  const extras = [
    fiber != null ? { label: t('diary.macros.fiber'), value: `${fiber} g` } : null,
    sugars != null ? { label: t('diary.meals.sugars'), value: `${sugars} g` } : null,
    satFat != null ? { label: t('diary.meals.saturatedFat'), value: `${satFat} g` } : null,
    sodium != null ? { label: t('diary.meals.sodium'), value: `${sodium} mg` } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.md,
        paddingVertical: 8,
        paddingHorizontal: 10,
        gap: 8,
      }}
    >
      <View className="flex-row items-center gap-2.5">
        <View
          style={{
            width: THUMB,
            height: THUMB,
            borderRadius: radii.sm,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {showProductImage ? (
            <Image
              source={{ uri: entry.image_url! }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              onError={() => setImageFailed(true)}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <RNImage
              source={mealImage}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          )}
        </View>

        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="bodyStrong" numberOfLines={1} style={{ fontSize: 14, lineHeight: 18 }}>
            {entry.food_name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
          {isScannedProduct ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 1,
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: radii.pill,
                backgroundColor: withAlpha(colors.primary, 0.16),
              }}
            >
              <Text variant="fine" style={{ color: colors.primary }}>
                {t('diary.meals.barcodeMatched')}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="items-end gap-0.5">
          <Text variant="bodyStrong" tone="brand" style={{ fontSize: 15, lineHeight: 18 }}>
            {Math.round(entry.calories)}
          </Text>
          <Text variant="fine" tone="brand">
            {t('diary.meals.kcalUnit')}
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <View className="flex-row justify-between gap-2">
          <MacroStat
            value={protein != null ? `${protein} g` : '—'}
            label={t('diary.macros.protein')}
          />
          <MacroStat
            value={carbs != null ? `${carbs} g` : '—'}
            label={t('diary.macros.carbs')}
          />
          <MacroStat value={fat != null ? `${fat} g` : '—'} label={t('diary.macros.fat')} />
        </View>

        {extras.length ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {extras.map((item) => `${item.label} ${item.value}`).join(' · ')}
          </Text>
        ) : null}

        <Pressable accessibilityRole="button" onPress={onEdit}>
          <Text variant="label" tone="brand">
            {t('diary.meals.editAmount')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MacroStat({ value, label }: { value: string; label: string }) {
  return (
    <View className="min-w-0 flex-1 items-center gap-0.5">
      <Text variant="bodySmall" style={{ fontWeight: '600' }}>
        {value}
      </Text>
      <Text variant="fine" tone="secondary">
        {label}
      </Text>
    </View>
  );
}
