import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { fonts } from '@/theme/fonts';
import { useThemeColors } from '@/theme/theme-provider';
import { cx } from '@/utils/cx';

const variantClass = {
  display: 'text-display',
  headingLarge: 'text-headingLarge',
  headingMedium: 'text-headingMedium',
  headingSmall: 'text-headingSmall',
  body: 'text-body',
  bodyStrong: 'text-body',
  bodySmall: 'text-bodySmall',
  caption: 'text-caption',
  fine: 'text-fine',
  label: 'text-label',
  button: 'text-button',
  metric: 'text-metric',
} as const;

/** Trackwise stack: Bricolage display + body, JetBrains metrics. */
const variantFont: Record<keyof typeof variantClass, TextStyle> = {
  display: {
    fontFamily: fonts.displayExtraBold,
    letterSpacing: -1.2,
  },
  headingLarge: {
    fontFamily: fonts.displayBold,
    letterSpacing: -0.8,
  },
  headingMedium: {
    fontFamily: fonts.displaySemiBold,
    letterSpacing: -0.4,
  },
  headingSmall: {
    fontFamily: fonts.bodySemiBold,
    letterSpacing: -0.2,
  },
  body: { fontFamily: fonts.bodyRegular },
  bodyStrong: { fontFamily: fonts.bodySemiBold },
  bodySmall: { fontFamily: fonts.bodyRegular },
  caption: { fontFamily: fonts.bodyMedium },
  fine: { fontFamily: fonts.bodyMedium },
  label: { fontFamily: fonts.bodySemiBold },
  button: { fontFamily: fonts.bodySemiBold },
  metric: { fontFamily: fonts.monoSemiBold },
};

export type TextVariant = keyof typeof variantClass;
export type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'onPrimary'
  | 'onSecondary'
  | 'error'
  | 'success'
  | 'brand';

type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
};

export function Text({
  variant = 'body',
  tone = 'primary',
  className,
  style,
  ...props
}: TextProps) {
  const colors = useThemeColors();
  const toneStyle: Record<TextTone, TextStyle> = {
    primary: { color: colors.textPrimary },
    secondary: { color: colors.textSecondary },
    muted: { color: colors.textMuted },
    onPrimary: { color: colors.textOnPrimary },
    onSecondary: { color: colors.textOnSecondary },
    error: { color: colors.error },
    success: { color: colors.success },
    brand: { color: colors.primary },
  };

  return (
    <RNText
      {...props}
      className={cx(variantClass[variant], className)}
      style={[variantFont[variant], toneStyle[tone], style]}
    />
  );
}
