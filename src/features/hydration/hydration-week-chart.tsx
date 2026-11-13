import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  HYDRATION_CHART_HEIGHT,
  weekChartScaleMax,
  weekChartYTicks,
} from '@/features/hydration/calculations';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type WeekDay = {
  dateKey: string;
  label: string;
  amountMl: number;
  isToday?: boolean;
};

type HydrationWeekChartProps = {
  days: WeekDay[];
  formatY: (ml: number) => string;
};

/**
 * Week water chart always renders 7 X days + Y (ml).
 * Empty weeks keep a 2 L scale so axes stay readable without bars.
 */
export function HydrationWeekChart({ days, formatY }: HydrationWeekChartProps) {
  const colors = useThemeColors();
  const amounts = days.map((day) => day.amountMl);
  const scaleMax = weekChartScaleMax(amounts);
  const ticks = weekChartYTicks(scaleMax);
  const yAxisWidth = 44;
  const labelRow = 20;
  const plotHeight = HYDRATION_CHART_HEIGHT;

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: 'row', height: plotHeight + labelRow }}>
        <View
          style={{
            width: yAxisWidth,
            height: plotHeight,
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingRight: spacing[2],
          }}
        >
          {[...ticks].reverse().map((tick) => (
            <Text key={tick} variant="fine" tone="muted" numberOfLines={1}>
              {formatY(tick)}
            </Text>
          ))}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              height: plotHeight,
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 6,
              borderLeftWidth: 1,
              borderBottomWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 4,
              paddingTop: 4,
            }}
          >
            {days.map((day) => {
              const ratio = scaleMax > 0 ? Math.min(1, day.amountMl / scaleMax) : 0;
              const barH = day.amountMl > 0 ? Math.max(4, ratio * (plotHeight - 8)) : 0;
              return (
                <View
                  key={day.dateKey}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                  }}
                >
                  {barH > 0 ? (
                    <View
                      style={{
                        width: '100%',
                        maxWidth: 28,
                        height: barH,
                        borderRadius: radii.sm,
                        backgroundColor: day.isToday ? colors.primary : colors.info,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: '100%',
                        maxWidth: 28,
                        height: 3,
                        borderRadius: radii.pill,
                        backgroundColor: colors.surfaceMuted,
                      }}
                    />
                  )}
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4, marginTop: 4 }}>
            {days.map((day) => (
              <View key={day.dateKey} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                <Text
                  variant="fine"
                  tone={day.isToday ? 'brand' : 'secondary'}
                  numberOfLines={1}
                >
                  {day.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
