import { Minus, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { stepServings } from '@/features/meal-plan/intake-display';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type ServingsStepperProps = {
  value: number;
  onChange: (next: number) => void;
  label: string;
  disabled?: boolean;
};

/** Compact ± servings control for planned amount and log intake. */
export function ServingsStepper({ value, onChange, label, disabled }: ServingsStepperProps) {
  const colors = useThemeColors();

  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="caption" tone="secondary" className="min-w-0 flex-1" numberOfLines={1}>
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="−"
          disabled={disabled}
          onPress={() => onChange(stepServings(value, -1))}
          hitSlop={6}
          style={{
            width: 32,
            height: 32,
            borderRadius: radii.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Minus size={16} color={colors.textPrimary} />
        </Pressable>
        <Text variant="bodyStrong" style={{ minWidth: 40, textAlign: 'center' }}>
          {String(value)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="+"
          disabled={disabled}
          onPress={() => onChange(stepServings(value, 1))}
          hitSlop={6}
          style={{
            width: 32,
            height: 32,
            borderRadius: radii.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Plus size={16} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}
