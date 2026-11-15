import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { MEAL_ORDER } from '@/features/diary/aggregations';
import { NutritionMacrosRow } from '@/features/food/nutrition-macros-row';
import { roundPlannedTotals, sumPlannedMacros } from '@/features/meal-plan/aggregations';
import { derivePlannedMealLogStatus } from '@/features/meal-plan/status';
import type { PlannedMeal } from '@/features/meal-plan/types';
import { iconSizes, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type MealPlanPreviewCardProps = {
  dateKey: string;
  meals: PlannedMeal[];
  isLoading?: boolean;
  isError?: boolean;
};

/** Diary entry into Meal Plan — one row, not a second nutrition summary. */
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
    const mealLabels = MEAL_ORDER.filter((meal) => meals.some((row) => row.meal_type === meal)).map(
      (meal) => t(`meals.${meal}`),
    );
    const remaining = meals.filter((row) => derivePlannedMealLogStatus(row) !== 'logged').length;
    return { totals, mealLabels, remaining };
  }, [meals, t]);

  function openMealPlan() {
    router.push({ pathname: '/food/meal-plan', params: { date: dateKey } });
  }

  return (
    <Card style={{ paddingVertical: spacing[4] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('diary.mealPlanEntry')}
        onPress={openMealPlan}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <View className="flex-row items-start gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="bodyStrong" numberOfLines={1}>
              {t('diary.mealPlanEntry')}
            </Text>
            {isLoading && !preview ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text variant="caption" tone="muted">
                  {t('common.loading')}
                </Text>
              </View>
            ) : (
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {isError
                  ? t('diary.mealPlanPreview.errorBody')
                  : preview
                    ? preview.remaining > 0
                      ? t('diary.mealPlanPreview.plannedSummary', {
                        meals: preview.mealLabels.join(' · '),
                        count: preview.remaining,
                      })
                      : t('diary.mealPlanPreview.plannedSummaryDone', {
                        meals: preview.mealLabels.join(' · '),
                      })
                    : t('diary.mealPlanPreview.emptyLabel')}
              </Text>
            )}
          </View>
          <ChevronRight size={iconSizes.md} color={colors.textMuted} />
        </View>

        {preview ? (
          <View style={{ marginTop: spacing[2] }}>
            <NutritionMacrosRow
              compact
              showCalories
              calories={preview.totals.calories}
              proteinG={preview.totals.proteinG}
              carbsG={preview.totals.carbsG}
              fatG={preview.totals.fatG}
            />
          </View>
        ) : null}

        <Text variant="caption" tone="muted" style={{ marginTop: spacing[2] }}>
          {t('diary.mealPlanEntryBody')}
        </Text>
      </Pressable>
    </Card>
  );
}
