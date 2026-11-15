import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { getFieldCursorProps } from '@/components/ui/field-styles';
import { fonts } from '@/theme/fonts';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type SetMetricFieldProps = Omit<TextInputProps, 'placeholder' | 'style'> & {
  unit: string;
  value: string;
  compact?: boolean;
};

export function SetMetricReadout({
  unit,
  value,
  compact = false,
  onPress,
}: {
  unit: string;
  value: string;
  compact?: boolean;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const empty = value.trim().length === 0;
  const frame = (
    <View
      style={{
        width: '100%',
        minHeight: compact ? 44 : 56,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoSemiBold,
          fontSize: 18,
          lineHeight: 22,
          color: empty ? colors.textMuted : colors.textPrimary,
        }}
      >
        {empty ? '0' : value}
      </Text>
      <Text variant="caption" tone="muted">
        {unit}
      </Text>
    </View>
  );

  if (!onPress) return frame;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flex: 1 }}>
      {frame}
    </Pressable>
  );
}

/**
 * While focused, keep a local draft so parent re-renders (timers, sibling fields)
 * cannot reset the native TextInput cursor/selection mid-gesture.
 * Store updates still flow through onChangeText on every keystroke.
 */
export function SetMetricField({
  unit,
  value,
  compact = false,
  onFocus,
  onBlur,
  onChangeText,
  ...props
}: SetMetricFieldProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const shown = focused ? draft : value;
  const empty = shown.trim().length === 0;

  return (
    <View
      style={{
        flex: 1,
        minHeight: compact ? 44 : 56,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: focused ? colors.primary : colors.border,
        backgroundColor: focused ? colors.surface : colors.surfaceMuted,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
      }}
    >
      <View style={{ flex: 1, minHeight: 22, justifyContent: 'center' }}>
        {empty ? (
          <Text
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              fontFamily: fonts.monoSemiBold,
              fontSize: 18,
              lineHeight: 22,
              color: colors.textMuted,
            }}
          >
            0
          </Text>
        ) : null}
        <TextInput
          {...props}
          {...getFieldCursorProps(colors)}
          value={shown}
          placeholder=""
          onChangeText={(text) => {
            setDraft(text);
            onChangeText?.(text);
          }}
          style={{
            fontFamily: fonts.monoSemiBold,
            fontSize: 18,
            lineHeight: 22,
            color: colors.textPrimary,
            padding: 0,
            margin: 0,
          }}
          onFocus={(event) => {
            setDraft(valueRef.current);
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            setDraft(valueRef.current);
            onBlur?.(event);
          }}
        />
      </View>
      <Text variant="caption" tone="muted" style={{ marginLeft: 8 }}>
        {unit}
      </Text>
    </View>
  );
}
