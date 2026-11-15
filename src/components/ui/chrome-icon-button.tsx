import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type ChromeIconButtonProps = {
  label: string;
  onPress: () => void;
  icon: (color: string) => ReactNode;
  disabled?: boolean;
  /** Match a screen title line instead of centering a taller control against it. */
  header?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Shared close / back / pager icon. Muted square, theme text color — not primary, not hardcoded white. */
export function ChromeIconButton({
  label,
  onPress,
  icon,
  disabled = false,
  header = false,
  style,
}: ChromeIconButtonProps) {
  const colors = useThemeColors();
  const box = header ? 32 : 44;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={header ? 8 : 6}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: box,
          height: box,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.md,
          backgroundColor: colors.surfaceMuted,
          opacity: disabled ? 0.35 : pressed ? 0.72 : 1,
        },
        style,
      ]}
    >
      {icon(colors.textPrimary)}
    </Pressable>
  );
}
