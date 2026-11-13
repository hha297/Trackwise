import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type WorkoutFilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** Shared pill filter — selected uses primary fill (matches PeriodSwitch / templates). */
export function WorkoutFilterChip({ label, selected, onPress }: WorkoutFilterChipProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radii.pill,
        backgroundColor: selected ? colors.primary : colors.surfaceMuted,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      <Text variant="caption" style={{ color: selected ? colors.textOnPrimary : colors.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}
