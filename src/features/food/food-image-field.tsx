import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, Trash2, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import {
  assertFoodImageWithinSizeLimit,
  formatFoodImageSizeLimit,
  type SelectedFoodImage,
  validateFoodImageSelection,
} from '@/features/food/food-image';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const EMPTY_DASH_STROKE = 1.75;
const EMPTY_DASH_PATTERN = '7 6';
/** Inset between dashed frame and inner content — kept equal on all sides. */
const FRAME_INSET = spacing[5];

type FoodImageFieldProps = {
  value: SelectedFoodImage | null;
  onChange: (next: SelectedFoodImage | null) => void;
  disabled?: boolean;
  /** Optional remote URL already saved (edit flows). */
  existingUrl?: string | null;
};

type FrameSize = { width: number; height: number };

function DashedFrameBorder({
  size,
  color,
}: {
  size: FrameSize;
  color: string;
}) {
  if (size.width <= 0 || size.height <= 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={size.width} height={size.height}>
        <Rect
          x={EMPTY_DASH_STROKE / 2}
          y={EMPTY_DASH_STROKE / 2}
          width={size.width - EMPTY_DASH_STROKE}
          height={size.height - EMPTY_DASH_STROKE}
          rx={radii.md}
          ry={radii.md}
          fill="none"
          stroke={color}
          strokeWidth={EMPTY_DASH_STROKE}
          strokeDasharray={EMPTY_DASH_PATTERN}
        />
      </Svg>
    </View>
  );
}

/**
 * Single food image picker for Create Food.
 * One image only · max 1 MB · library pick · local preview.
 */
export function FoodImageField({
  value,
  onChange,
  disabled = false,
  existingUrl = null,
}: FoodImageFieldProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState<FrameSize>({ width: 0, height: 0 });

  const previewUri = value?.uri ?? existingUrl ?? null;

  function handleFrameLayout(width: number, height: number) {
    setFrameSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }

  async function pickImage() {
    if (disabled || busy) return;
    setLocalError(null);
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setLocalError(t('food.image.permissionDenied'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.85,
        exif: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const limit = formatFoodImageSizeLimit();
      let selected = validateFoodImageSelection({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        emptyUriMessage: t('errors.imageReadFailed'),
        invalidTypeMessage: t('errors.imageTypeInvalid'),
        tooLargeMessage: t('errors.imageTooLarge', { limit }),
      });
      selected = await assertFoodImageWithinSizeLimit(
        selected,
        t('errors.imageTooLarge', { limit }),
      );
      onChange(selected);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('food.image.selectFailed'));
    } finally {
      setBusy(false);
    }
  }

  function clearImage() {
    if (disabled || busy) return;
    setLocalError(null);
    onChange(null);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text variant="label" tone="secondary" style={styles.headerTitle}>
          {t('food.image.title')}
        </Text>
        <Text variant="caption" tone="muted" style={styles.headerHint}>
          {t('food.image.hint', { limit: formatFoodImageSizeLimit() })}
        </Text>
      </View>

      {previewUri ? (
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            handleFrameLayout(width, height);
          }}
          style={[styles.frame, { backgroundColor: colors.surfaceMuted }]}
        >
          <DashedFrameBorder size={frameSize} color={colors.primary} />
          <View style={styles.frameInner}>
            <Image
              source={{ uri: previewUri }}
              style={[styles.previewImage, { backgroundColor: colors.surface }]}
              contentFit="cover"
              accessibilityLabel={t('food.image.selectedA11y')}
            />
            <View style={styles.previewActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('food.image.replaceA11y')}
                disabled={disabled || busy}
                onPress={() => void pickImage()}
                style={({ pressed }) => [
                  styles.actionChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <RefreshCw size={iconSizes.sm} color={colors.textPrimary} strokeWidth={2.25} />
                <Text variant="label" tone="primary">
                  {t('food.image.replace')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('food.image.removeA11y')}
                disabled={disabled || busy}
                onPress={clearImage}
                style={({ pressed }) => [
                  styles.actionChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Trash2 size={iconSizes.sm} color={colors.error} strokeWidth={2.25} />
                <Text variant="label" tone="error">
                  {t('food.image.remove')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('food.image.addA11y')}
          disabled={disabled || busy}
          onPress={() => void pickImage()}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            handleFrameLayout(width, height);
          }}
          style={({ pressed }) => [
            styles.frame,
            styles.frameEmpty,
            {
              backgroundColor: colors.surfaceMuted,
              opacity: pressed || busy ? 0.85 : 1,
            },
          ]}
        >
          <DashedFrameBorder size={frameSize} color={colors.primary} />
          <View style={styles.frameInner}>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={styles.emptyContent}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.primary }]}>
                  <ImagePlus size={22} color={colors.textOnPrimary} strokeWidth={2.4} />
                </View>
                <View style={styles.emptyCopy}>
                  <Text variant="bodyStrong" style={styles.emptyTitle}>
                    {t('food.image.add')}
                  </Text>
                  <Text variant="caption" tone="muted" style={styles.emptyHint}>
                    {t('food.image.addHint')}
                  </Text>
                </View>
                <View style={styles.emptyMeta}>
                  <Camera size={14} color={colors.textMuted} />
                  <Text variant="caption" tone="muted" style={styles.emptyMetaText}>
                    {t('food.image.addMeta')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Pressable>
      )}

      {localError ? (
        <Text variant="caption" tone="error" style={styles.error}>
          {localError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing[3],
    width: '100%',
  },
  header: {
    gap: spacing[1],
    paddingRight: spacing[1],
  },
  headerTitle: {
    flexShrink: 1,
  },
  headerHint: {
    flexShrink: 1,
  },
  /**
   * Outer frame owns the dashed border.
   * No padding here — absolute SVG is relative to this box's padding edge,
   * so padding on this node would inset the border and erase the visual gap.
   */
  frame: {
    width: '100%',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  frameEmpty: {
    minHeight: 236,
    // Centers the padded inner block when the frame is taller than its content,
    // keeping top/bottom breathing room even relative to the dashed border.
    justifyContent: 'center',
  },
  /** Equal inset from dashed border on all sides. */
  frameInner: {
    width: '100%',
    padding: FRAME_INSET,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  emptyContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    width: '100%',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyHint: {
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
  },
  emptyMetaText: {
    textAlign: 'center',
    flexShrink: 1,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radii.sm,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    width: '100%',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 44,
    minWidth: 120,
    flexGrow: 1,
    flexBasis: 0,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  error: {
    marginTop: spacing[1],
  },
});
