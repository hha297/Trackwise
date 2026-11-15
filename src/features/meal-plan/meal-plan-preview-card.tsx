import { router } from 'expo-router';
import { CalendarDays, ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { MEAL_ORDER } from '@/features/diary/aggregations';
import {
  roundPlannedTotals,
  sumPlannedMacros,
} from '@/features/meal-plan/aggregations';
import type { PlannedMeal } from '@/features/meal-plan/types';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type MealPlanPreviewCardProps = {
  dateKey: string;
  meals: PlannedMeal[];
  isLoading?: boolean;
  isError?: boolean;
};

/** Compact Diary Home Meal Plan entry — not a second nutrition dashboard. */
export function MealPlanPreviewCard({
  dateKey,
  meals,
  isLoading = false,
  isError = false,
}: MealPlanPreviewCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const preview = useMemo(() => {
    if (meals.length === 0) return null;
    const totals = roundPlannedTotals(sumPlannedMacros(meals));
    const mealSlots = MEAL_ORDER.filter((meal) =>
      meals.some((row) => row.meal_type === meal),
    ).length;
    return { totals, mealSlots };
  }, [meals]);

  function openMealPlan() {
    router.push({ pathname: '/food/meal-plan', params: { date: dateKey } });
  }

  return (
    <Card style={{ gap: spacing[3] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('diary.mealPlanEntry')}
        onPress={openMealPlan}
        style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      >
        <View className="flex-row items-center gap-3">
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primaryMuted,
            }}
          >
            <CalendarDays size={22} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="headingSmall" numberOfLines={1}>
              {t('diary.mealPlanEntry')}
            </Text>
            {isLoading && !preview ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text variant="caption" tone="muted">
                  {t('common.loading')}
                </Text>
              </View>
            ) : preview ? (
              <>
                <Text variant="headingMedium" tone="brand">
                  {preview.totals.calories} {t('diary.meals.kcalUnit')}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {t('diary.mealPlanPreview.plannedSummary', {
                    protein: preview.totals.proteinG,
                    count: preview.mealSlots,
                  })}
                </Text>
              </>
            ) : (
              <Text variant="caption" tone="muted">
                {t('diary.mealPlanPreview.emptyLabel')}
              </Text>
            )}
          </View>
          <ChevronRight size={iconSizes.md} color={colors.textMuted} />
        </View>
      </Pressable>

      <Text variant="bodySmall" tone="secondary">
        {isError ? t('diary.mealPlanPreview.errorBody') : t('diary.mealPlanEntryBody')}
      </Text>

      {!isLoading ? (
        <Button
          label={
            preview ? t('diary.mealPlanPreview.openCta') : t('diary.mealPlanPreview.planCta')
          }
          variant={preview ? 'secondary' : 'primary'}
          onPress={openMealPlan}
        />
      ) : null}
    </Card>
  );
}
