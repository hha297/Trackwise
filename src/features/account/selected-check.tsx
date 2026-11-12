import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const SIZE = 24;
const ICON = 14;

/** Primary circular check used for selected settings (e.g. language). */
export function SelectedCheck({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: motion.fast });
  }, [visible, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.82 + progress.value * 0.18 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.circle, { backgroundColor: colors.primary }, animStyle]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      accessibilityRole="image"
      accessibilityLabel={visible ? t('common.selected') : undefined}
    >
      <Check size={ICON} color={colors.textOnPrimary} strokeWidth={3.2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
