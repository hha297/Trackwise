import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radii, spacing } from '@/theme';
import { fonts } from '@/theme/fonts';
import { useThemeColors } from '@/theme/theme-provider';

const AVATAR = 48;
const ADD = 36;

type FoodListRowProps = {
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
  /** Secondary line, e.g. "480 kcal · 400 g" */
  detail: string;
  onPress: () => void;
  /** Show hairline under the row (default true). */
  showDivider?: boolean;
  disabled?: boolean;
  loading?: boolean;
};

/** Compact Spotify-style food row: avatar | name+detail | + */
export function FoodListRow({
  name,
  brand,
  imageUrl,
  detail,
  onPress,
  showDivider = true,
  disabled = false,
  loading = false,
}: FoodListRowProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  const isDisabled = disabled || loading;
  const subtitle = brand?.trim() ? `${brand.trim()} · ${detail}` : detail;
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('food.add.addFoodA11y', { name })}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      cssInterop={false}
      style={({ pressed }) => [
        styles.row,
        showDivider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        pressed && !isDisabled ? { backgroundColor: colors.surfaceMuted } : null,
        isDisabled && !loading ? { opacity: 0.55 } : null,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
        {showImage ? (
          <Image
            source={{ uri: imageUrl! }}
            style={styles.avatarImage}
            contentFit="cover"
            onError={() => setImageFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[styles.avatarLetter, { color: colors.primary }]}>{initial}</Text>
        )}
      </View>

      <View style={styles.copy}>
        <Text
          variant="bodyStrong"
          numberOfLines={2}
          ellipsizeMode="tail"
          style={styles.name}
        >
          {name}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={styles.detail}
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.add,
          {
            backgroundColor: loading ? colors.surfaceMuted : colors.primary,
          },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Plus size={18} color={colors.textOnPrimary} strokeWidth={2.75} />
        )}
      </View>
    </Pressable>
  );
}

export function formatFoodNutritionDetail(input: {
  calories?: number | null;
  servingLabel?: string | null;
  unavailableLabel?: string;
}): string {
  const parts: string[] = [];
  if (input.calories != null && Number.isFinite(input.calories)) {
    parts.push(`${Math.round(input.calories)} kcal`);
  }
  const serving = input.servingLabel?.trim();
  if (serving) parts.push(serving);
  return parts.length > 0 ? parts.join(' · ') : (input.unavailableLabel ?? 'Nutrition unavailable');
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[1],
    gap: spacing[3],
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
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
  copy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: '100%',
    justifyContent: 'center',
    gap: spacing[1],
    paddingRight: spacing[2],
  },
  name: {
    fontFamily: fonts.ibmSemiBold,
    flexShrink: 1,
  },
  detail: {
    flexShrink: 1,
  },
  add: {
    width: ADD,
    height: ADD,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
    marginLeft: spacing[1],
  },
});
