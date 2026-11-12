import { usePathname } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Modal, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  LANGUAGE_FLAGS,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  changeAppLanguage,
  useAppLanguage,
} from '@/i18n';
import { elevation, iconSizes, radii, spacing } from '@/theme';
import { useTheme, useThemeColors } from '@/theme/theme-provider';

const MENU_MIN_WIDTH = 220;
const MENU_MAX_WIDTH = 272;
const GAP_BELOW_TRIGGER = 8;

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
};

/** Icon-only language control (flag); menu lists full language names. */
export function LanguageDropdown() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<ViewInstance>(null);
  const language = useAppLanguage();

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(false);
      setMenuPos(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  function closeMenu() {
    setOpen(false);
    setMenuPos(null);
  }

  function openMenu() {
    triggerRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      const screenWidth = Dimensions.get('window').width;
      const minWidth = Math.min(MENU_MAX_WIDTH, Math.max(MENU_MIN_WIDTH, width));
      // Align menu to the right edge of the icon when near the trailing edge.
      const left = Math.max(12, Math.min(x + width - minWidth, screenWidth - minWidth - 12));
      setMenuPos({ top: y + height + GAP_BELOW_TRIGGER, left, minWidth });
      setOpen(true);
    });
  }

  function toggleMenu() {
    if (open) closeMenu();
    else openMenu();
  }

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={LANGUAGE_LABELS[language]}
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          onPress={toggleMenu}
          cssInterop={false}
          style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.trigger,
              { backgroundColor: isDark ? colors.primary : '#FFFFFF' },
            ]}
          >
            <Text style={styles.flag}>{LANGUAGE_FLAGS[language]}</Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            onPress={closeMenu}
          />
          {menuPos ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.menu,
                elevation.dropdown('#000000'),
                {
                  top: menuPos.top,
                  left: menuPos.left,
                  minWidth: menuPos.minWidth,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              {SUPPORTED_LANGUAGES.map((code) => {
                const selected = language === code;
                return (
                  <Pressable
                    key={code}
                    accessibilityRole="menuitem"
                    accessibilityLabel={LANGUAGE_LABELS[code]}
                    accessibilityState={{ selected }}
                    cssInterop={false}
                    onPress={() => void changeAppLanguage(code).then(closeMenu)}
                    style={({ pressed }) => [
                      styles.option,
                      selected ? { backgroundColor: colors.primaryMuted } : null,
                      pressed && !selected ? { backgroundColor: colors.surfaceMuted } : null,
                    ]}
                  >
                    <View style={[styles.optionFlagWrap, { backgroundColor: colors.surfaceMuted }]}>
                      <Text style={styles.optionFlag}>{LANGUAGE_FLAGS[code]}</Text>
                    </View>
                    <View style={styles.optionCopy}>
                      <Text
                        variant={selected ? 'bodyStrong' : 'body'}
                        style={{ color: selected ? colors.primary : colors.textPrimary }}
                      >
                        {LANGUAGE_LABELS[code]}
                      </Text>
                    </View>
                    {selected ? (
                      <View style={[styles.check, { backgroundColor: colors.primary }]}>
                        <Check size={iconSizes.xs + 1} color={colors.textOnPrimary} strokeWidth={2.8} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  trigger: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 22, lineHeight: 26 },
  modalRoot: { flex: 1 },
  menu: {
    position: 'absolute',
    maxWidth: MENU_MAX_WIDTH,
    borderRadius: radii.md,
    borderWidth: 0,
    padding: spacing[2],
  },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    paddingHorizontal: spacing[2],
    borderRadius: radii.lg,
  },
  optionFlagWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionFlag: { fontSize: 19, lineHeight: 23 },
  optionCopy: { flex: 1 },
  check: {
    width: spacing[6],
    height: spacing[6],
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
