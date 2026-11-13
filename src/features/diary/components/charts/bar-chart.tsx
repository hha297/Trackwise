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
  // Progress 30d (~5) / 90d biweekly (~7) must label every bar — skipping looks broken.
  const crowded = items.length > 8;
  const dense = items.length > 12;
  const labelReserve = crowded ? 16 : 22;
  const valueReserve = crowded ? 0 : 14;
  const barArea = Math.max(48, height - labelReserve - valueReserve - 8);
  const showLabels = visibleLabelIndexes(items.length, crowded ? 6 : items.length);

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
    <View style={[styles.row, { height, gap: dense ? 2 : 4 }]}>
      {items.map((item, index) => {
        const value = item.value ?? 0;
        const barH = Math.max(4, (value / max) * barArea);
        const showAxis = showLabels.has(index);
        return (
          <View key={item.key} style={styles.column}>
            {!crowded ? (
              item.value != null ? (
                <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.valueLabel}>
                  {formatValue(item.value)}
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
                  maxWidth: dense ? 22 : crowded ? 28 : 36,
                  backgroundColor: item.muted ? colors.surfaceMuted : colors.primary,
                  opacity: item.value == null ? 0.35 : 1,
                },
              ]}
            />
            {showAxis ? (
              <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.axisLabel}>
                {item.label}
              </Text>
            ) : (
              <View style={{ height: 12 }} />
            )}
          </View>
        );
      })}
      {target != null && target > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.targetLine,
            {
              bottom: labelReserve + (target / max) * barArea,
              borderColor: colors.borderStrong ?? colors.border,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
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
  axisLabel: {
    fontSize: typography.fine.size,
    lineHeight: typography.fine.lineHeight,
    maxWidth: '100%',
  },
  bar: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 6,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
