import { ChevronDown, ChevronUp, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { MealType } from '@/features/food/types';
import { roundPlannedTotals, sumPlannedMacros } from '@/features/meal-plan/aggregations';
import type { PlannedMeal } from '@/features/meal-plan/types';
import { iconSizes, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type MealPlanSectionProps = {
  meal: MealType;
  rows: PlannedMeal[];
  highlighted?: boolean;
  onAdd: () => void;
  children: ReactNode;
};

/** Compact Breakfast/Lunch/Dinner/Snacks block — collapsible, one Add. */
export function MealPlanSection({
  meal,
  rows,
  highlighted,
  onAdd,
  children,
}: MealPlanSectionProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [open, setOpen] = useState(true);
  const sectionTotals = roundPlannedTotals(sumPlannedMacros(rows));

  return (
    <Card
      style={{
        gap: spacing[2],
        borderColor: highlighted ? colors.primary : colors.border,
        borderWidth: highlighted ? 1.5 : undefined,
      }}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={t(`meals.${meal}`)}
          onPress={() => setOpen((current) => !current)}
          className="min-w-0 flex-1 flex-row items-center gap-2"
        >
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="headingSmall" numberOfLines={1}>
              {t(`meals.${meal}`)}
            </Text>
            <Text variant="caption" tone={rows.length ? 'brand' : 'muted'}>
              {rows.length
                ? `${sectionTotals.calories} ${t('diary.meals.kcalUnit')}`
                : t('mealPlan.emptyMeal')}
            </Text>
          </View>
          {open ? (
            <ChevronUp size={iconSizes.md} color={colors.textMuted} />
          ) : (
            <ChevronDown size={iconSizes.md} color={colors.textMuted} />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mealPlan.addMeal')}
          onPress={onAdd}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
          }}
        >
          <Plus size={18} color={colors.textOnPrimary} strokeWidth={2.5} />
        </Pressable>
      </View>

      {open ? children : null}
    </Card>
  );
}
