import { ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { iconSizes, layout, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { cx } from '@/utils/cx';

import { FieldPlaceholder } from './field-placeholder';
import { fieldShell, getFieldTypography } from './field-styles';
import { Text } from './text';

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type SelectProps<T extends string = string> = {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
};

export function Select<T extends string = string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
  disabled = false,
}: SelectProps<T>) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const resolvedPlaceholder = placeholder ?? t('common.selectOption');

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const showPlaceholder = !selected;
  const borderColor = error ? colors.error : open ? colors.borderFocus : colors.border;

  return (
    <View style={{ gap: layout.labelGap }}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cx('flex-row items-center border px-3.5', disabled && 'opacity-50')}
        style={{
          backgroundColor: colors.surface,
          borderColor,
          minHeight: layout.inputMinHeight,
          borderRadius: radii.md,
        }}
      >
        <View style={fieldShell.wrap}>
          {showPlaceholder ? <FieldPlaceholder label={resolvedPlaceholder} /> : null}
          {selected ? (
            <Text
              variant="body"
              style={{ ...getFieldTypography(colors), paddingVertical: spacing[2] }}
            >
              {selected.label}
            </Text>
          ) : (
            <View style={{ height: layout.inputMinHeight - 4 }} />
          )}
        </View>
        <ChevronDown size={iconSizes.md} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text variant="caption" tone="error">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetRoot}>
          <Pressable
            style={[styles.sheetBackdrop, { backgroundColor: colors.overlay }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            onPress={() => setOpen(false)}
          />
          <SafeAreaView
            edges={['bottom']}
            style={[
              styles.sheetPanel,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: radii.lg,
                borderTopRightRadius: radii.lg,
              },
            ]}
          >
            <View className="items-center px-4 pb-2 pt-3">
              <View
                className="mb-3 h-1 w-10 rounded-full"
                style={{ backgroundColor: colors.borderStrong }}
              />
              <Text variant="headingSmall" className="mb-1 self-start">
                {label}
              </Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map((option) => {
                const isActive = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between px-4 py-3.5"
                    style={{
                      backgroundColor: isActive ? colors.surfaceMuted : undefined,
                    }}
                  >
                    <Text
                      variant={isActive ? 'bodyStrong' : 'body'}
                      style={{
                        color: isActive ? colors.primary : colors.textPrimary,
                        fontFamily: isActive ? undefined : getFieldTypography(colors).fontFamily,
                      }}
                    >
                      {option.label}
                    </Text>
                    {isActive ? (
                      <Text variant="caption" tone="brand">
                        Selected
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetPanel: {
    maxHeight: '70%',
  },
});
