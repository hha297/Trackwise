import { useIsFocused } from 'expo-router';
import { useLayoutEffect, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type SlideSide = 'left' | 'right' | 'top' | 'bottom';

export type SlideTransitionProps = {
  children: ReactNode;
  /**
   * Edge the content slides in from.
   * Overridden when one of `left` / `right` / `top` / `bottom` is true.
   * @default 'right'
   */
  from?: SlideSide;
  /** Slide in from the left. */
  left?: boolean;
  /** Slide in from the right. */
  right?: boolean;
  /** Slide in from the top. */
  top?: boolean;
  /** Slide in from the bottom. */
  bottom?: boolean;
  /** Animation length in ms. @default 280 */
  duration?: number;
  /** Travel distance in px. @default 24 */
  distance?: number;
  /** Fade in while sliding. @default true */
  fade?: boolean;
  /**
   * Replay enter animation when the screen gains focus (tab / stack switches).
   * @default true
   */
  replayOnFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

function resolveSide(props: SlideTransitionProps): SlideSide {
  if (props.left) return 'left';
  if (props.right) return 'right';
  if (props.top) return 'top';
  if (props.bottom) return 'bottom';
  return props.from ?? 'right';
}

function offsetFor(side: SlideSide, distance: number) {
  switch (side) {
    case 'left':
      return { x: -distance, y: 0 };
    case 'right':
      return { x: distance, y: 0 };
    case 'top':
      return { x: 0, y: -distance };
    case 'bottom':
      return { x: 0, y: distance };
  }
}

/**
 * Reusable enter transition — slides (+ optional fade) from one of four edges.
 *
 * Avoids flicker by parking the view at the start offset (hidden) on blur,
 * then only animating forward on focus — never snapping from fully-visible → hidden mid-frame.
 */
export function SlideTransition({
  children,
  from = 'right',
  left,
  right,
  top,
  bottom,
  duration = 280,
  distance = 24,
  fade = true,
  replayOnFocus = true,
  style,
}: SlideTransitionProps) {
  const side = resolveSide({ from, left, right, top, bottom, children });
  const start = offsetFor(side, distance);
  const focused = useIsFocused();

  const tx = useSharedValue(start.x);
  const ty = useSharedValue(start.y);
  const opacity = useSharedValue(fade ? 0 : 1);

  useLayoutEffect(() => {
    const timing = {
      duration,
      easing: Easing.out(Easing.cubic),
    };

    if (replayOnFocus && !focused) {
      // Leave parked at the enter pose so the next focus doesn't flash full content first.
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(opacity);
      tx.value = start.x;
      ty.value = start.y;
      if (fade) opacity.value = 0;
      return;
    }

    // Already at start from mount or blur — only animate forward (no mid-frame reset).
    tx.value = withTiming(0, timing);
    ty.value = withTiming(0, timing);
    if (fade) opacity.value = withTiming(1, timing);
  }, [focused, replayOnFocus, duration, fade, start.x, start.y, tx, ty, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.fill, animatedStyle, style]}>{children}</Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
