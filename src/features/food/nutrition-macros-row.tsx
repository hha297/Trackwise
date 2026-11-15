import { Beef, Droplets, Flame, Wheat } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type NutritionMacrosRowProps = {
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  calories?: number | null;
  /** Include calories chip (default false — protein/carbs/fat only). */
  showCalories?: boolean;
  /** Smaller chips for list cards. */
  compact?: boolean;
  /** Parent is already surfaceMuted — chips use surface for contrast. */
  onMutedSurface?: boolean;
};

type MacroItem = {
  key: string;
  label: string;
  value: string;
  color: string;
  icon: ReactNode;
};

function formatGrams(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} g` : `${rounded.toFixed(1)} g`;
}

function formatKcal(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)} kcal`;
}

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

/** Colored icon + full label macros in a reliable 2×2 grid. */
export function NutritionMacrosRow({
  proteinG,
  carbsG,
  fatG,
  calories,
  showCalories = false,
  compact = false,
  onMutedSurface = false,
}: NutritionMacrosRowProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const iconSize = compact ? 14 : 16;
  const chipBg = onMutedSurface ? colors.surface : colors.surfaceMuted;
  const rowGap = compact ? spacing[2] : spacing[4];

  const items: MacroItem[] = [
    ...(showCalories
      ? [
        {
          key: 'calories',
          label: t('diary.nutrition.calories'),
          value: formatKcal(calories),
          color: colors.macroCalories,
          icon: <Flame size={iconSize} color={colors.macroCalories} strokeWidth={2.2} />,
        },
      ]
      : []),
    {
      key: 'protein',
      label: t('diary.macros.protein'),
      value: formatGrams(proteinG),
      color: colors.macroProtein,
      icon: <Beef size={iconSize} color={colors.macroProtein} strokeWidth={2.2} />,
    },
    {
      key: 'carbs',
      label: t('diary.macros.carbs'),
      value: formatGrams(carbsG),
      color: colors.macroCarbs,
      icon: <Wheat size={iconSize} color={colors.macroCarbs} strokeWidth={2.2} />,
    },
    {
      key: 'fat',
      label: t('diary.macros.fat'),
      value: formatGrams(fatG),
      color: colors.macroFat,
      icon: <Droplets size={iconSize} color={colors.macroFat} strokeWidth={2.2} />,
    },
  ];

  const rows = chunkPairs(items);

  return (
    <View style={{ width: '100%', gap: rowGap }}>
      {rows.map((row) => (
        <View key={row.map((item) => item.key).join('-')} style={{ flexDirection: 'row', gap: rowGap }}>
          {row.map((item) => (
            <View
              key={item.key}
              style={[
                styles.chip,
                compact && styles.chipCompact,
                {
                  flex: 1,
                  backgroundColor: chipBg,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.chipHeader}>
                {item.icon}
                <Text
                  variant="caption"
                  tone="secondary"
                  numberOfLines={1}
                  style={styles.label}
                >
                  {item.label}
                </Text>
              </View>
              <Text variant={compact ? 'bodySmall' : 'bodyStrong'} numberOfLines={1}>
                {item.value}
              </Text>
            </View>
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipCompact: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    gap: spacing[1],
  },
  chipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  label: {
    flexShrink: 1,
    minWidth: 0,
  },
});
