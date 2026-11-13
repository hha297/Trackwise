import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { PROGRESS_PERIODS, type ProgressPeriod } from '@/features/progress/types';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type PeriodControlProps = {
  value: ProgressPeriod;
  labels: Record<ProgressPeriod, string>;
  onChange: (value: ProgressPeriod) => void;
};

/** Compact 7 / 30 / 90 day control — selected uses primary fill. */
export function PeriodControl({ value, labels, onChange }: PeriodControlProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
      ]}
    >
      {PROGRESS_PERIODS.map((period) => {
        const selected = value === period;
        return (
          <Pressable
            key={period}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(period)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text
              variant="fine"
              numberOfLines={1}
              style={{
                color: selected ? colors.textOnPrimary : colors.textSecondary,
              }}
            >
              {labels[period]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  option: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 36,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
});
