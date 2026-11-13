import { GripVertical } from 'lucide-react-native';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

/** Fallback row height + list gap before first onLayout measure. */
export const SET_ROW_STRIDE = 64;
const SET_ROW_GAP = 8;

type SortableSetListProps<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  disabled?: boolean;
  dragLabel: string;
  onReorder: (from: number, to: number) => void;
  renderContent: (item: T, index: number) => ReactNode;
};

function sameOrder<T>(a: T[], b: T[], keyExtractor: (item: T) => string) {
  return (
    a.length === b.length && a.every((item, index) => keyExtractor(item) === keyExtractor(b[index]!))
  );
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  const next = [...items];
  const [row] = next.splice(from, 1);
  if (!row) return items;
  next.splice(to, 0, row);
  return next;
}

/**
 * Absolute-slot list with live neighbor preview.
 * Drop keeps the preview hole until the next React paint applies the new order
 * with settling tops — no flex reflow, no animated↔static style swap.
 */
export function SortableSetList<T>({
  data,
  keyExtractor,
  disabled = false,
  dragLabel,
  onReorder,
  renderContent,
}: SortableSetListProps<T>) {
  const activeIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragOffset = useSharedValue(0);
  const pendingCommit = useSharedValue(0);
  const strideSv = useSharedValue(SET_ROW_STRIDE);

  const [items, setItems] = useState(data);
  const [stride, setStride] = useState(SET_ROW_STRIDE);
  const [settling, setSettling] = useState(false);
  const draggingRef = useRef(false);
  const dataOrderKey = data.map(keyExtractor).join('\0');
  const itemsOrderKey = items.map(keyExtractor).join('\0');

  useLayoutEffect(() => {
    if (draggingRef.current || settling) return;
    if (!sameOrder(items, data, keyExtractor)) {
      setItems(data);
    }
  }, [data, dataOrderKey, items, itemsOrderKey, keyExtractor, settling]);

  useLayoutEffect(() => {
    if (!settling) return;
    dragOffset.value = 0;
    activeIndex.value = -1;
    hoverIndex.value = -1;
    pendingCommit.value = 0;
    draggingRef.current = false;
    setSettling(false);
  }, [settling, itemsOrderKey, activeIndex, dragOffset, hoverIndex, pendingCommit]);

  const onRowLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height <= 0) return;
    const next = Math.round(height + SET_ROW_GAP);
    if (next === stride) return;
    setStride(next);
    strideSv.value = next;
  };

  const clearDragFlags = () => {
    draggingRef.current = false;
  };

  const commitReorder = (from: number, to: number) => {
    if (from === to) {
      dragOffset.value = 0;
      activeIndex.value = -1;
      hoverIndex.value = -1;
      pendingCommit.value = 0;
      draggingRef.current = false;
      return;
    }
    // Same React batch: new slots + settling tops (preview hole → final slots).
    setItems((current) => moveItem(current, from, to));
    setSettling(true);
    onReorder(from, to);
  };

  const count = items.length;
  const listHeight = count > 0 ? count * stride - SET_ROW_GAP : 0;

  return (
    <View style={{ height: listHeight, position: 'relative' }}>
      {items.map((item, index) => (
        <SortableSetRow
          key={keyExtractor(item)}
          index={index}
          count={count}
          setNumber={index + 1}
          disabled={disabled || count < 2}
          dragLabel={dragLabel}
          settling={settling}
          stride={strideSv}
          activeIndex={activeIndex}
          hoverIndex={hoverIndex}
          dragOffset={dragOffset}
          pendingCommit={pendingCommit}
          onRowLayout={index === 0 ? onRowLayout : undefined}
          onDragStart={() => {
            draggingRef.current = true;
          }}
          onDragCancel={clearDragFlags}
          onReorder={commitReorder}
        >
          {renderContent(item, index)}
        </SortableSetRow>
      ))}
    </View>
  );
}

type SortableSetRowProps = {
  index: number;
  count: number;
  setNumber: number;
  disabled: boolean;
  dragLabel: string;
  settling: boolean;
  stride: SharedValue<number>;
  activeIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  dragOffset: SharedValue<number>;
  pendingCommit: SharedValue<number>;
  onRowLayout?: (event: LayoutChangeEvent) => void;
  onDragStart: () => void;
  onDragCancel: () => void;
  onReorder: (from: number, to: number) => void;
  children: ReactNode;
};

function SortableSetRow({
  index,
  count,
  setNumber,
  disabled,
  dragLabel,
  settling,
  stride,
  activeIndex,
  hoverIndex,
  dragOffset,
  pendingCommit,
  onRowLayout,
  onDragStart,
  onDragCancel,
  onReorder,
  children,
}: SortableSetRowProps) {
  const colors = useThemeColors();

  const pan = Gesture.Pan()
    .activateAfterLongPress(160)
    .enabled(!disabled)
    .onStart(() => {
      pendingCommit.value = 0;
      activeIndex.value = index;
      hoverIndex.value = index;
      dragOffset.value = 0;
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      const step = stride.value;
      const minY = -index * step;
      const maxY = (count - 1 - index) * step;
      const y = Math.max(minY, Math.min(maxY, event.translationY));
      dragOffset.value = y;
      const delta = Math.round(y / step);
      hoverIndex.value = Math.max(0, Math.min(count - 1, index + delta));
    })
    .onEnd(() => {
      const from = activeIndex.value;
      const to = hoverIndex.value;
      const step = stride.value;
      if (from >= 0 && to >= 0 && from !== to) {
        pendingCommit.value = 1;
        // Hold the preview hole until JS applies new order + settling.
        dragOffset.value = (to - from) * step;
        runOnJS(onReorder)(from, to);
      } else {
        dragOffset.value = 0;
        activeIndex.value = -1;
        hoverIndex.value = -1;
        pendingCommit.value = 0;
        runOnJS(onDragCancel)();
      }
    })
    .onFinalize(() => {
      if (pendingCommit.value === 1) return;
      dragOffset.value = 0;
      activeIndex.value = -1;
      hoverIndex.value = -1;
      runOnJS(onDragCancel)();
    });

  const style = useAnimatedStyle(() => {
    const step = stride.value;
    const base = index * step;

    if (settling) {
      return {
        position: 'absolute' as const,
        left: 0,
        right: 0,
        top: base,
        zIndex: 0,
      };
    }

    const active = activeIndex.value;
    const hover = hoverIndex.value;

    if (active === index) {
      return {
        position: 'absolute' as const,
        left: 0,
        right: 0,
        top: base + dragOffset.value,
        zIndex: 30,
      };
    }

    let shift = 0;
    if (active >= 0 && hover >= 0 && active !== hover) {
      if (active < hover && index > active && index <= hover) {
        shift = -step;
      } else if (active > hover && index >= hover && index < active) {
        shift = step;
      }
    }

    return {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      top: base + shift,
      zIndex: 0,
    };
  });

  return (
    <Animated.View
      onLayout={onRowLayout}
      style={[{ backgroundColor: colors.surface, borderRadius: radii.md }, style]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 6,
          minHeight: SET_ROW_STRIDE - SET_ROW_GAP,
        }}
      >
        <GestureDetector gesture={pan}>
          <View
            accessibilityRole="button"
            accessibilityLabel={dragLabel}
            style={{
              minWidth: 48,
              height: 44,
              paddingHorizontal: 8,
              borderRadius: radii.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <GripVertical size={14} color={colors.textMuted} />
            <Text variant="metric">{setNumber}</Text>
          </View>
        </GestureDetector>
        {children}
      </View>
    </Animated.View>
  );
}
