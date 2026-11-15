import { Clock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

import { formatTimeOfDay } from './schedule-plan';
import type { TimeOfDay } from './types';

type TimeFieldProps = {
  label: string;
  value: TimeOfDay;
  onChange: (next: TimeOfDay) => void;
  disabled?: boolean;
  /**
   * `row` — label left, time control right (workout / hydration).
   * `chip` — compact clock + time only (under meal name).
   */
  variant?: 'row' | 'chip';
};

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.stepper}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View style={styles.stepperRow}>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          onPress={() => onChange(value <= min ? max : value - 1)}
          style={[styles.stepBtn, { backgroundColor: colors.surfaceMuted }]}
        >
          <Text variant="headingSmall">−</Text>
        </Pressable>
        <Text variant="metric" style={styles.stepValue}>
          {String(value).padStart(2, '0')}
        </Text>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          onPress={() => onChange(value >= max ? min : value + 1)}
          style={[styles.stepBtn, { backgroundColor: colors.surfaceMuted }]}
        >
          <Text variant="headingSmall">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TimeChip({
  display,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  display: string;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      cssInterop={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Clock size={16} color={colors.textSecondary} strokeWidth={2.2} />
      <Text variant="bodyStrong" style={styles.timeText}>
        {display}
      </Text>
    </Pressable>
  );
}

/**
 * Time picker trigger — clock + HH:mm (never a chevron).
 * Uses cssInterop={false} so NativeWind cannot force column layout on Pressable.
 */
export function TimeField({
  label,
  value,
  onChange,
  disabled = false,
  variant = 'row',
}: TimeFieldProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const display = useMemo(() => formatTimeOfDay(value), [value]);

  const openPicker = () => {
    setDraft(value);
    setOpen(true);
  };

  return (
    <>
      {variant === 'chip' ? (
        <TimeChip
          display={display}
          disabled={disabled}
          onPress={openPicker}
          accessibilityLabel={`${label}, ${display}`}
        />
      ) : (
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text variant="body" numberOfLines={2}>
              {label}
            </Text>
          </View>
          <TimeChip
            display={display}
            disabled={disabled}
            onPress={openPicker}
            accessibilityLabel={`${label}, ${display}`}
          />
        </View>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable cssInterop={false} style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text variant="headingSmall">{label}</Text>
            <View style={styles.pickers}>
              <Stepper
                label={t('notifications.time.hour')}
                value={draft.hour}
                min={0}
                max={23}
                onChange={(hour) => setDraft((prev) => ({ ...prev, hour }))}
              />
              <Stepper
                label={t('notifications.time.minute')}
                value={draft.minute}
                min={0}
                max={59}
                onChange={(minute) => setDraft((prev) => ({ ...prev, minute }))}
              />
            </View>
            <View style={styles.actions}>
              <Button
                label={t('notifications.time.cancel')}
                variant="secondary"
                fullWidth={false}
                onPress={() => setOpen(false)}
              />
              <Button
                label={t('notifications.time.save')}
                fullWidth={false}
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: 44,
    width: '100%',
  },
  rowLabel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingRight: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 40,
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
    flexShrink: 0,
  },
  timeText: {
    fontVariant: ['tabular-nums'],
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing[4],
  },
  sheet: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[4],
  },
  pickers: {
    flexDirection: 'row',
    gap: spacing[4],
    justifyContent: 'center',
  },
  stepper: {
    alignItems: 'center',
    gap: spacing[2],
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'flex-end',
  },
});
