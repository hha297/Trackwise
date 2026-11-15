import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

import { FieldPlaceholder } from './field-placeholder';
import { fieldShell, getFieldCompactTypography, getFieldCursorProps } from './field-styles';

type CompactInputProps = Omit<TextInputProps, 'placeholder'> & {
  placeholder?: string;
};

/** Compact single-line field (workout sets, inline editors) with DM Sans placeholder. */
export function CompactInput({
  placeholder,
  value,
  defaultValue,
  onChangeText,
  style,
  onFocus,
  onBlur,
  ...props
}: CompactInputProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const [innerValue, setInnerValue] = useState(defaultValue ?? '');
  const resolvedValue = value !== undefined ? value : innerValue;
  const showPlaceholder =
    Boolean(placeholder) && !focused && String(resolvedValue ?? '').length === 0;

  return (
    <View
      className="h-11 flex-1 justify-center border px-3"
      style={{
        backgroundColor: colors.surfaceMuted,
        borderColor: focused ? colors.borderFocus : colors.border,
        borderRadius: radii.md,
      }}
    >
      <View style={fieldShell.wrap}>
        {showPlaceholder && placeholder ? (
          <FieldPlaceholder label={placeholder} compact />
        ) : null}
        <TextInput
          {...props}
          {...getFieldCursorProps(colors)}
          value={value}
          defaultValue={defaultValue}
          placeholder=""
          style={[{ ...getFieldCompactTypography(colors), paddingVertical: spacing[2] }, style]}
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
    </View>
  );
}
