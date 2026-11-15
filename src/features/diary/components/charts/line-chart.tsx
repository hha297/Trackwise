import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

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

/** Consecutive non-null runs — line breaks across days with no food logs. */
function lineSegments(
  values: (number | null)[],
  xFor: (index: number) => number,
  yFor: (value: number) => number,
): string[] {
  const segments: string[] = [];
  let current: string[] = [];

  values.forEach((value, index) => {
    if (value == null) {
      if (current.length >= 2) segments.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${xFor(index)},${yFor(value)}`);
  });
  if (current.length >= 2) segments.push(current.join(' '));
  return segments;
}

/**
 * Macro trend line chart: continuous lines between logged days, dots on every
 * value (including isolated single-day points so sparse ranges stay visible).
 */
export function LineChart({ labels, series, height = 148, emptyLabel }: LineChartProps) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(320);
  const pointCount = Math.max(labels.length, 1);
  const dense = pointCount > 12;
  const crowded = pointCount > 8;
  const padX = dense ? 8 : 12;
  const padY = 14;
  const chartW = Math.max(1, width - padX * 2);
  const chartH = Math.max(1, height - padY * 2);
  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const max = Math.max(1, ...allValues);
  const hasData = allValues.length > 0;
  const showLabels = visibleLabelIndexes(labels.length, crowded ? 6 : labels.length);
  const sortedLabelIndexes = [...showLabels].sort((a, b) => a - b);
  const firstLabel = sortedLabelIndexes[0];
  const lastLabel = sortedLabelIndexes[sortedLabelIndexes.length - 1];
  const strokeWidth = dense ? 2 : 2.5;
  const dotRadius = dense ? 2.5 : crowded ? 3 : 3.5;

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  }

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

  const guides = [0.25, 0.5, 0.75, 1].map((ratio) => padY + chartH - ratio * chartH);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Svg width={width} height={height}>
        {guides.map((y) => (
          <Line
            key={`guide-${y}`}
            x1={padX}
            y1={y}
            x2={padX + chartW}
            y2={y}
            stroke={colors.border}
            strokeWidth={StyleSheet.hairlineWidth}
            strokeDasharray="4 4"
          />
        ))}

        {series.map((line) =>
          lineSegments(line.values, xFor, yFor).map((points, segmentIndex) => (
            <Polyline
              key={`${line.key}-seg-${segmentIndex}`}
              points={points}
              fill="none"
              stroke={line.color}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )),
        )}

        {series.map((line) =>
          line.values.map((value, index) =>
            value == null ? null : (
              <Circle
                key={`${line.key}-${index}`}
                cx={xFor(index)}
                cy={yFor(value)}
                r={dotRadius}
                fill={line.color}
                stroke={colors.surface}
                strokeWidth={dense ? 1 : 1.5}
              />
            ),
          ),
        )}
      </Svg>

      <View style={styles.axisRow}>
        {labels.map((label, index) => {
          if (!showLabels.has(index)) {
            return <View key={`axis-${index}`} style={styles.axisSlot} />;
          }
          return (
            <View key={`axis-${index}`} style={styles.axisSlot}>
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
                {label}
              </Text>
            </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[2],
    overflow: 'hidden',
    width: '100%',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  axisRow: {
    flexDirection: 'row',
    width: '100%',
    overflow: 'hidden',
    minHeight: 16,
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
