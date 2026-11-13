import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

import { FieldPlaceholder } from './field-placeholder';
import { fieldShell, getFieldCursorProps, getFieldTypography } from './field-styles';
import { Text } from './text';

type TextAreaProps = Omit<TextInputProps, 'multiline'> & {
  label: string;
  error?: string;
  minHeight?: number;
};

export function TextArea({
  label,
  error,
  minHeight = 120,
  onFocus,
  onBlur,
  onChangeText,
  style,
  placeholder,
  value,
  defaultValue,
  ...props
}: TextAreaProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const [innerValue, setInnerValue] = useState(defaultValue ?? '');

  const resolvedValue = value !== undefined ? value : innerValue;
  const showPlaceholder =
    Boolean(placeholder) && !focused && String(resolvedValue ?? '').length === 0;
  const borderColor = error ? colors.error : focused ? colors.borderFocus : colors.border;

  return (
    <View className="gap-1.5">
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <View
        className="border px-3.5 py-2"
        style={{
          minHeight,
          backgroundColor: colors.surfaceMuted,
          borderColor,
          borderRadius: radii.md,
        }}
      >
        <View style={[fieldShell.wrap, { minHeight: minHeight - 16, justifyContent: 'flex-start' }]}>
          {showPlaceholder && placeholder ? (
            <FieldPlaceholder label={placeholder} style={{ top: 8 }} />
          ) : null}
          <TextInput
            {...props}
            {...getFieldCursorProps(colors)}
            multiline
            textAlignVertical="top"
            value={value}
            defaultValue={defaultValue}
            accessibilityLabel={label}
            placeholder=""
            style={[
              {
                ...getFieldTypography(colors),
                minHeight: minHeight - 16,
                paddingTop: 8,
                paddingBottom: 8,
              },
              style,
            ]}
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
      {error ? (
        <Text variant="caption" tone="error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
