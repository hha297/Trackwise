import { Moon, Sun } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { elevation, iconSizes, motion, radii } from '@/theme';
import { useTheme } from '@/theme/theme-provider';

const TRACK_WIDTH = 56;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 24;
const THUMB_PAD = 3;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_PAD * 2;

type ThemeToggleProps = {
  /** `switch` for Account/Appearance; `icon` for auth top bar and compact chrome. */
  variant?: 'switch' | 'icon';
};

/** Sun/moon theme control — sliding switch or compact icon. */
export function ThemeToggle({ variant = 'switch' }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { scheme, colors, toggleLightDark } = useTheme();
  const isDark = scheme === 'dark';
  const progress = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isDark ? 1 : 0, { duration: motion.normal });
  }, [isDark, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  const accessibilityLabel = isDark ? t('auth.themeA11yDark') : t('auth.themeA11yLight');

  if (variant === 'icon') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: isDark }}
        hitSlop={8}
        onPress={toggleLightDark}
        style={({ pressed }) => [styles.hit, pressed && styles.iconPressed]}
      >
        <View
          style={[
            styles.iconWrap,
            {
              // Match language control: primary fill in dark, white in light.
              backgroundColor: isDark ? colors.primary : colors.surface,
              borderColor: isDark ? colors.primary : colors.border,
            },
          ]}
        >
          {isDark ? (
            <Moon size={iconSizes.md} color={colors.textOnOverlay} strokeWidth={2.25} />
          ) : (
            <Sun size={iconSizes.md} color={colors.textPrimary} strokeWidth={2.25} />
          )}
        </View>
      </Pressable>
    );
  }

  // Light: white track + primary border/thumb. Dark: muted track + primary thumb.
  const trackBg = isDark ? colors.surfaceMuted : colors.surface;
  const trackBorder = isDark ? colors.border : colors.primary;
  const thumbBg = colors.primary;
  const iconColor = isDark ? colors.textOnOverlay : colors.textOnPrimary;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={toggleLightDark}
      style={styles.hit}
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
              borderColor: 'transparent',
            },
            thumbStyle,
          ]}
        >
          {isDark ? (
            <Moon size={iconSizes.xs} color={iconColor} strokeWidth={2.5} />
          ) : (
            <Sun size={iconSizes.xs} color={iconColor} strokeWidth={2.5} />
          )}
        </Animated.View>
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
  iconPressed: {
    opacity: 0.72,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
