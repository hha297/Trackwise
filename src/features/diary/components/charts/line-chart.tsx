import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { spacing, typography } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export type LineSeries = {
  key: string;
  color: string;
  values: (number | null)[];
};

type LineChartProps = {
  labels: string[];
  series: LineSeries[];
  height?: number;
  emptyLabel: string;
};

/** Keep axis readable when many points — show ends + evenly spaced middles. */
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

export function LineChart({ labels, series, height = 148, emptyLabel }: LineChartProps) {
  const colors = useThemeColors();
  const pointCount = Math.max(labels.length, 1);
  const width = Math.max(280, Math.min(pointCount * 36, 720));
  const padX = 12;
  const padY = 16;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const max = Math.max(1, ...allValues);
  const hasData = allValues.length > 0;
  // Match bar charts: label every point through 8; only thin out denser series.
  const showLabels = visibleLabelIndexes(labels.length, labels.length > 8 ? 6 : labels.length);

  if (!hasData) {
    return (
      <View style={styles.empty}>
        <Text variant="bodySmall" tone="muted">
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const xFor = (index: number) =>
    padX + (labels.length <= 1 ? chartW / 2 : (index / (labels.length - 1)) * chartW);
  const yFor = (value: number) => padY + chartH - (value / max) * chartH;

  return (
    <View style={styles.root}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {series.map((line) => {
          const points = line.values
            .map((value, index) => (value == null ? null : `${xFor(index)},${yFor(value)}`))
            .filter(Boolean)
            .join(' ');
          return (
            <Polyline
              key={line.key}
              points={points}
              fill="none"
              stroke={line.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        {series.map((line) =>
          line.values.map((value, index) =>
            value == null ? null : (
              <Circle
                key={`${line.key}-${index}`}
                cx={xFor(index)}
                cy={yFor(value)}
                r={3}
                fill={line.color}
              />
            ),
          ),
        )}
      </Svg>

      <View style={styles.labelRow}>
        {[...showLabels]
          .sort((a, b) => a - b)
          .map((index, order, visible) => {
            const label = labels[index] ?? '';
            const align =
              order === 0 ? 'left' : order === visible.length - 1 ? 'right' : 'center';
            return (
              <Text
                key={`${label}-${index}`}
                variant="caption"
                tone="secondary"
                numberOfLines={1}
                style={[styles.axisLabel, { textAlign: align, flex: 1 }]}
              >
                {label}
              </Text>
            );
          })}
      </View>

      <View style={styles.legend}>
        {series.map((line) => (
          <View key={line.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: line.color }]} />
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.legendText}>
              {line.key}
            </Text>
          </View>
        ))}
      </View>

      {/* keep colors referenced for empty theme paths */}
      <View style={{ display: 'none', backgroundColor: colors.surface }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[2],
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
    gap: spacing[2],
  },
  axisLabel: {
    fontSize: typography.fine.size,
    lineHeight: typography.fine.lineHeight,
    minWidth: 0,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendText: {
    flexShrink: 1,
  },
});
