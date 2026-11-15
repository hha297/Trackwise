import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Image as RNImage, Pressable, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import {
  classifyDiaryEntry,
  type DiaryEntryKind,
} from '@/features/diary/entry-classification';
import { NutritionMacrosRow } from '@/features/food/nutrition-macros-row';
import type { FoodEntry } from '@/features/food/types';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

/** Smaller than meal header (48) so entries nest under the meal section. */
const THUMB = 44;

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

function kindLabel(kind: DiaryEntryKind, t: (key: string) => string) {
  switch (kind) {
    case 'planned_meal':
      return t('diary.meals.kindPlannedMeal');
    case 'recipe':
      return t('diary.meals.kindRecipe');
    case 'scanned_product':
      return t('diary.meals.scannedProduct');
    default:
      return null;
  }
}

/**
 * Full food-data block on surfaceMuted (same as Meal Plan “Nothing logged yet”).
 * Avatar + name + servings + 2×2 nutrients.
 */
export function FoodLogEntryCard({ entry, mealImage, onEdit }: FoodLogEntryCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);
  const showProductImage = Boolean(entry.image_url) && !imageFailed;
  const kind = classifyDiaryEntry(entry);
  const origin = kindLabel(kind, t);

  const detailLine = useMemo(() => {
    const parts: string[] = [quantityLabel(entry)];
    const brand = entry.brand?.trim();
    if (brand && kind !== 'recipe' && kind !== 'planned_meal') {
      parts.push(brand);
    }
    if (origin) {
      parts.push(origin);
    }
    return parts.join(' · ');
  }, [entry, kind, origin]);

  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.md,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3],
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('diary.meals.editAmount')}
        accessibilityHint={t('diary.meals.editHint')}
        disabled={!onEdit}
        onPress={onEdit}
        style={({ pressed }) => [{ opacity: pressed && onEdit ? 0.92 : 1 }]}
      >
        <View className="flex-row items-center gap-3">
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
            <Text variant="bodyStrong" numberOfLines={2}>
              {entry.food_name}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {detailLine}
            </Text>
          </View>
        </View>

        <View style={{ width: '100%', marginTop: spacing[2] }}>
          <NutritionMacrosRow
            compact
            onMutedSurface
            showCalories
            calories={entry.calories}
            proteinG={entry.protein_g}
            carbsG={entry.carbs_g}
            fatG={entry.fat_g}
          />
        </View>
      </Pressable>
    </View>
  );
}
