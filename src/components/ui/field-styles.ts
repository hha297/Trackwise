import { Platform, StyleSheet } from 'react-native';

import { colors as staticColors } from '@/theme';
import { fonts } from '@/theme/fonts';
import type { ThemeColors } from '@/theme/themes';

/** Blinking caret + text selection tint — primary brand across all fields. */
export function getFieldCursorProps(themeColors: ThemeColors = staticColors) {
  return {
    cursorColor: themeColors.primary,
    selectionColor: themeColors.primary,
  } as const;
}

/** @deprecated Prefer getFieldCursorProps(useThemeColors()) */
export const fieldCursorProps = getFieldCursorProps();

/**
 * Shared field typography. Native Android/iOS placeholders ignore custom
 * fonts — always pair with FieldPlaceholder instead of TextInput.placeholder.
 */
export function getFieldTypography(themeColors: ThemeColors = staticColors) {
  return {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    color: themeColors.textPrimary,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  } as const;
}

export function getFieldPlaceholderTypography(themeColors: ThemeColors = staticColors) {
  return {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    color: themeColors.textMuted,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  } as const;
}

export function getFieldCompactTypography(themeColors: ThemeColors = staticColors) {
  return {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 22,
    color: themeColors.textPrimary,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  } as const;
}

export function getFieldCompactPlaceholderTypography(themeColors: ThemeColors = staticColors) {
  return {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 22,
    color: themeColors.textMuted,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  } as const;
}

/** @deprecated Prefer getFieldTypography(useThemeColors()) */
export const fieldTypography = getFieldTypography();
/** @deprecated Prefer getFieldPlaceholderTypography(useThemeColors()) */
export const fieldPlaceholderTypography = getFieldPlaceholderTypography();
/** @deprecated Prefer getFieldCompactTypography(useThemeColors()) */
export const fieldCompactTypography = getFieldCompactTypography();
/** @deprecated Prefer getFieldCompactPlaceholderTypography(useThemeColors()) */
export const fieldCompactPlaceholderTypography = getFieldCompactPlaceholderTypography();

export const fieldShell = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  placeholder: {
    ...fieldPlaceholderTypography,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  placeholderCompact: {
    ...fieldCompactPlaceholderTypography,
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
