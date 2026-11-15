import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { elevation, motion, radii } from '@/theme';
import { useTheme, useThemeColors } from '@/theme/theme-provider';

const TRACK_WIDTH = 56;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 24;
const THUMB_PAD = 3;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_PAD * 2;

type SettingsSwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * Trackwise settings switch — ThemeToggle shape, with clear on vs off colors.
 * On: primary track + white/onPrimary thumb.
 * Off: muted track + muted thumb.
 */
export function SettingsSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: SettingsSwitchProps) {
  const { scheme } = useTheme();
  const colors = useThemeColors();
  const isDark = scheme === 'dark';
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: motion.normal });
  }, [value, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  const trackBg = value ? colors.primary : isDark ? colors.surfaceMuted : colors.surface;
  const trackBorder = value ? colors.primary : colors.border;
  const thumbBg = value ? colors.textOnPrimary : isDark ? colors.border : colors.surfaceMuted;
  const thumbBorder = value ? 'transparent' : colors.border;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={[styles.hit, disabled && styles.disabled]}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: trackBg,
            borderColor: trackBorder,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            elevation.thumb('#000000'),
            {
              backgroundColor: thumbBg,
              borderColor: thumbBorder,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: THUMB_PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
