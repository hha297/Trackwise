import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { layout, radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type WorkoutIconButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
  tone?: 'default' | 'danger';
  size?: number;
};

export function WorkoutIconButton({
  accessibilityLabel,
  onPress,
  children,
  tone = 'default',
  size = layout.inputMinHeight,
}: WorkoutIconButtonProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: tone === 'danger' ? colors.errorMuted : colors.surfaceMuted,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
