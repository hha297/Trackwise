import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { iconSizes, layout, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

import { FieldPlaceholder } from './field-placeholder';
import { fieldShell, getFieldCursorProps, getFieldTypography } from './field-styles';
import { Text } from './text';

type InputProps = TextInputProps & {
  label: string;
  error?: string;
  passwordToggle?: boolean;
};

export function Input({
  label,
  error,
  passwordToggle = false,
  secureTextEntry,
  onFocus,
  onBlur,
  onChangeText,
  style,
  placeholder,
  value,
  defaultValue,
  ...props
}: InputProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [innerValue, setInnerValue] = useState(defaultValue ?? '');
  const isPassword = Boolean(passwordToggle || secureTextEntry);
  const obscure = isPassword ? (passwordToggle ? hidden : Boolean(secureTextEntry)) : false;

  const resolvedValue = value !== undefined ? value : innerValue;
  const showPlaceholder =
    Boolean(placeholder) && !focused && String(resolvedValue ?? '').length === 0;
  const borderColor = error ? colors.error : focused ? colors.borderFocus : colors.border;

  return (
    <View style={{ gap: layout.labelGap }}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          paddingHorizontal: spacing[3],
          backgroundColor: colors.surface,
          borderColor,
          minHeight: layout.inputMinHeight,
          borderRadius: radii.md,
        }}
      >
        <View style={fieldShell.wrap}>
          {showPlaceholder && placeholder ? <FieldPlaceholder label={placeholder} /> : null}
          <TextInput
            {...props}
            {...getFieldCursorProps(colors)}
            value={value}
            defaultValue={defaultValue}
            accessibilityLabel={label}
            placeholder=""
            secureTextEntry={obscure}
            style={[{ ...getFieldTypography(colors), paddingVertical: spacing[2] }, style]}
            onChangeText={(text) => {
              if (value === undefined) {
                setInnerValue(text);
              }
              onChangeText?.(text);
            }}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
          />
        </View>
        {passwordToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('auth.showPassword') : t('auth.hidePassword')}
            hitSlop={8}
            onPress={() => setHidden((next) => !next)}
            style={{ paddingLeft: spacing[2] }}
          >
            {hidden ? (
              <Eye size={iconSizes.md} color={colors.textMuted} />
            ) : (
              <EyeOff size={iconSizes.md} color={colors.textMuted} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
