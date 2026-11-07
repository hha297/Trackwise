import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { elevation, iconSizes, radii, withAlpha } from '@/theme';
import { fonts } from '@/theme/fonts';
import { useTheme, useThemeColors } from '@/theme/theme-provider';

import { scanImageSource } from './scan-image';

const DOCK_HEIGHT = 64;
const DOCK_HEIGHT_COMPACT = 58;
const SCAN_SIZE = 58;
const SCAN_SIZE_COMPACT = 54;

export function useFloatingTabBarClearance(): number {
  const { width, height } = useWindowDimensions();
  const compact = width <= 360 || height <= 500;
  const dockHeight = compact ? DOCK_HEIGHT_COMPACT : DOCK_HEIGHT;
  return dockHeight + 40;
}

type FloatingTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export function FloatingTabBar({
  state,
  descriptors,
  navigateToTab,
  emitter,
  insets,
}: FloatingTabBarProps) {
  const colors = useThemeColors();
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const { width, height } = useWindowDimensions();
  const compact = width <= 360 || height <= 500;
  const landscape = width > height;
  const dockHeight = compact ? DOCK_HEIGHT_COMPACT : DOCK_HEIGHT;
  const scanSize = compact ? SCAN_SIZE_COMPACT : SCAN_SIZE;
  const scanIconSize = scanSize - 6;
  const scanFocused = state.routes[state.index]?.name === 'scan';
  const bottomGap = Math.max(8, insets.bottom);
  const horizontalGap = landscape ? 24 : compact ? 12 : 16;
  const dockWidth = Math.min(width - horizontalGap * 2, 620);
  const dockElevation = isDark
    ? ({
      shadowColor: colors.primary,
      shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    } as const)
    : elevation.tabBar('#202020');
  const dockBorder = isDark ? withAlpha(colors.primary, 0.16) : colors.border;

  // Keep the dock mounted while Scan is open so the GIF never reloads (1–2s flash).
  // Hide visually + ignore touches instead of returning null.
  return (
    <View
      pointerEvents={scanFocused ? 'none' : 'box-none'}
      accessibilityElementsHidden={scanFocused}
      importantForAccessibility={scanFocused ? 'no-hide-descendants' : 'auto'}
      style={[styles.overlay, scanFocused ? styles.overlayHidden : null]}
    >
      {insets.bottom > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.homeIndicatorFill,
            { height: insets.bottom, backgroundColor: colors.background },
          ]}
        />
      ) : null}

      <View
        style={[
          styles.dock,
          dockElevation,
          {
            bottom: bottomGap,
            width: dockWidth,
            height: dockHeight,
            backgroundColor: colors.surface,
            borderColor: dockBorder,
            borderRadius: radii.pill,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const isScan = route.name === 'scan';
          const color = focused ? colors.primary : colors.textMuted;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;

          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          const onLongPress = () => {
            emitter.emit({ type: 'tabLongPress', target: route.key });
          };

          if (isScan) {
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                accessibilityState={focused ? { selected: true } : {}}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.scanSlot}
              >
                <View
                  style={[
                    styles.scanButton,
                    elevation.floatingControl('#202020'),
                    {
                      width: scanSize,
                      height: scanSize,
                      borderRadius: radii.pill,
                      backgroundColor: colors.primary,
                      // Lift Scan so its label sits on the same baseline as Diary/etc.
                      top: -(scanSize * 0.42),
                    },
                  ]}
                >
                  <Image
                    source={scanImageSource}
                    style={{ width: scanIconSize, height: scanIconSize }}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    autoplay
                    tintColor={colors.textOnPrimary}
                    accessible={false}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.25}
                  style={[styles.label, { color: focused ? colors.primary : colors.textMuted }]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
            >
              <View style={styles.iconWrap}>
                {options.tabBarIcon?.({
                  focused,
                  color,
                  size: compact ? iconSizes.md + 1 : iconSizes.lg - 1,
                })}
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                maxFontSizeMultiplier={1.25}
                style={[styles.label, { color }]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  overlayHidden: {
    opacity: 0,
  },
  homeIndicatorFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  dock: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    overflow: 'visible',
  },
  tab: {
    flex: 1,
    minWidth: 48,
    minHeight: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  iconWrap: {
    minWidth: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
    width: '100%',
  },
  scanSlot: {
    flex: 1,
    minWidth: 56,
    minHeight: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingBottom: 10,
    paddingHorizontal: 2,
    overflow: 'visible',
    zIndex: 2,
  },
  scanButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
