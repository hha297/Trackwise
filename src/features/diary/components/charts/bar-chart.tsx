import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing, typography } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export type BarChartItem = {
  key: string;
  label: string;
  value: number | null;
  muted?: boolean;
};

type BarChartProps = {
  items: BarChartItem[];
  target?: number | null;
  height?: number;
  formatValue?: (value: number) => string;
  emptyLabel: string;
};

const AXIS_HEIGHT = 16;
/** Empty / zero days — just tall enough to see a tick. */
const EMPTY_STUB = 3;
const MIN_VALUE_BAR = 4;

/** Keep axis readable when many bars — show ends + evenly spaced middles. */
function visibleLabelIndexes(count: number, maxLabels = 6): Set<number> {
  if (count <= maxLabels) {
    return new Set(Array.from({ length: count }, (_, i) => i));
  }
  const indexes = new Set<number>([0, count - 1]);
  const inner = maxLabels - 2;
  for (let i = 1; i <= inner; i += 1) {
    indexes.add(Math.round((i * (count - 1)) / (inner + 1)));
  }
  return indexes;
}

/**
 * Proportional bars scaled to the tallest value (and optional target).
 * Empty / zero days get a tiny stub so the column is still visible.
 * Dense ranges (30/90) keep equal column widths, tight gaps, in-bounds axis labels.
 */
export function BarChart({
  items,
  target,
  height = 140,
  formatValue = (v) => String(Math.round(v)),
  emptyLabel,
}: BarChartProps) {
  const colors = useThemeColors();
  const numeric = items.map((i) => i.value ?? 0);
  const max = Math.max(1, ...(target != null ? [target, ...numeric] : numeric));
  const hasAny = items.some((i) => i.value != null && i.value > 0);

  const dense = items.length > 12;
  const crowded = items.length > 8;
  const showValues = !crowded;
  const valueReserve = showValues ? 14 : 0;
  const barArea = Math.max(48, height - AXIS_HEIGHT - valueReserve - 8);
  const showLabels = visibleLabelIndexes(items.length, crowded ? 6 : items.length);
  const sortedLabelIndexes = [...showLabels].sort((a, b) => a - b);
  const firstLabel = sortedLabelIndexes[0];
  const lastLabel = sortedLabelIndexes[sortedLabelIndexes.length - 1];
  const gap = dense ? 1 : crowded ? 2 : 4;
  const barRadius = dense ? 2 : crowded ? 3 : 6;

  if (!hasAny) {
    return (
      <View style={styles.empty}>
        <Text variant="bodySmall" tone="muted">
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { height }]}>
      <View style={[styles.plot, { height: barArea + valueReserve, gap }]}>
        {items.map((item) => {
          const hasValue = item.value != null && item.value > 0;
          const barH = hasValue
            ? Math.max(MIN_VALUE_BAR, ((item.value ?? 0) / max) * barArea)
            : EMPTY_STUB;
          return (
            <View key={item.key} style={styles.column}>
              {showValues ? (
                hasValue ? (
                  <Text
                    variant="caption"
                    tone="secondary"
                    numberOfLines={1}
                    style={styles.valueLabel}
                  >
                    {formatValue(item.value!)}
                  </Text>
                ) : (
                  <View style={{ height: valueReserve }} />
                )
              ) : null}
              <View
                style={[
                  styles.bar,
                  {
                    height: barH,
                    borderRadius: barRadius,
                    backgroundColor: hasValue
                      ? item.muted
                        ? colors.surfaceMuted
                        : colors.primary
                      : colors.surfaceMuted,
                  },
                ]}
              />
            </View>
          );
        })}
        {target != null && target > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.targetLine,
              {
                bottom: (target / max) * barArea,
                borderColor: colors.borderStrong ?? colors.border,
              },
            ]}
          />
        ) : null}
      </View>

      <View style={[styles.axisRow, { height: AXIS_HEIGHT }]}>
        {items.map((item, index) => {
          if (!showLabels.has(index)) {
            return <View key={item.key} style={styles.axisSlot} />;
          }
          return (
            <View key={item.key} style={styles.axisSlot}>
              <Text
                variant="caption"
                tone="secondary"
                numberOfLines={1}
                style={[
                  styles.axisLabel,
                  {
                    textAlign:
                      index === firstLabel ? 'left' : index === lastLabel ? 'right' : 'center',
                  },
                ]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    justifyContent: 'flex-end',
    gap: 4,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
    width: '100%',
    position: 'relative',
  },
  column: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  valueLabel: {
    fontSize: typography.fine.size,
    lineHeight: typography.fine.lineHeight,
  },
  bar: {
    width: '100%',
    alignSelf: 'stretch',
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  axisRow: {
    flexDirection: 'row',
    width: '100%',
    overflow: 'hidden',
  },
  axisSlot: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    justifyContent: 'center',
  },
  axisLabel: {
    fontSize: typography.fine.size,
    lineHeight: typography.fine.lineHeight,
    width: '100%',
  },
});
