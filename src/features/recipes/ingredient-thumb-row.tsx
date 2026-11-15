import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radii, spacing } from '@/theme';
import { fonts } from '@/theme/fonts';
import { useThemeColors } from '@/theme/theme-provider';

const THUMB = 40;

type IngredientThumbRowProps = {
  name: string;
  detail: string;
  imageUrl?: string | null;
  showDivider?: boolean;
};

/** Compact ingredient row with food thumbnail (letter fallback). */
export function IngredientThumbRow({
  name,
  detail,
  imageUrl,
  showDivider = true,
}: IngredientThumbRowProps) {
  const colors = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;
  const initial = (name.trim().charAt(0) || '?').toUpperCase();

  return (
    <View
      style={[
        styles.row,
        showDivider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
        {showImage ? (
          <Image
            source={{ uri: imageUrl! }}
            style={styles.thumbImage}
            contentFit="cover"
            onError={() => setImageFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[styles.letter, { color: colors.primary }]}>{initial}</Text>
        )}
      </View>
      <View style={styles.copy}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbImage: {
    width: THUMB,
    height: THUMB,
  },
  letter: {
    fontFamily: fonts.ibmBold,
    fontSize: 16,
    lineHeight: 20,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
