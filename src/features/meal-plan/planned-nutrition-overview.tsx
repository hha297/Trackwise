import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { Goal } from '@/features/goals/types';
import type { PlannedMacroTotals } from '@/features/meal-plan/aggregations';
import { plannedProgress } from '@/features/meal-plan/planned-progress';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type PlannedNutritionOverviewProps = {
  totals: PlannedMacroTotals;
  goal: Goal | null | undefined;
};

function MetricRow({
  label,
  planned,
  target,
  unit,
  color,
}: {
  label: string;
  planned: number;
  target: number | null;
  unit: string;
  color: string;
}) {
  const progress = plannedProgress(planned, target);
  const colors = useThemeColors();

  return (
    <View style={{ gap: 4 }}>
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="caption" tone="secondary" numberOfLines={1} className="min-w-0 shrink">
          {label}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {target != null
            ? `${Math.round(planned)} / ${Math.round(target)} ${unit}`
            : `${Math.round(planned)} ${unit}`}
        </Text>
      </View>
      {progress.ratio != null ? (
        <View
          style={{
            height: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceMuted,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.round(progress.ratio * 100)}%`,
              height: '100%',
              borderRadius: radii.pill,
              backgroundColor: progress.overTarget ? colors.warning : color,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Daily planned nutrition vs goals — never uses Diary consumed totals. */
export function PlannedNutritionOverview({ totals, goal }: PlannedNutritionOverviewProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const hasAnyTarget = Boolean(
    goal &&
      (goal.daily_calorie_target > 0 ||
        (goal.protein_g != null && goal.protein_g > 0) ||
        (goal.carbs_g != null && goal.carbs_g > 0) ||
        (goal.fat_g != null && goal.fat_g > 0)),
  );

  return (
    <Card style={{ gap: spacing[3] }}>
      <View style={{ gap: 2 }}>
        <Text variant="headingSmall">{t('mealPlan.plannedNutrition')}</Text>
        <Text variant="caption" tone="muted">
          {t('mealPlan.plannedNutritionHint')}
        </Text>
      </View>

      <MetricRow
        label={t('diary.nutrition.calories')}
        planned={totals.calories}
        target={goal?.daily_calorie_target && goal.daily_calorie_target > 0 ? goal.daily_calorie_target : null}
        unit={t('diary.meals.kcalUnit')}
        color={colors.macroCalories}
      />
      <MetricRow
        label={t('diary.macros.protein')}
        planned={totals.proteinG}
        target={goal?.protein_g != null && goal.protein_g > 0 ? goal.protein_g : null}
        unit="g"
        color={colors.macroProtein}
      />
      <MetricRow
        label={t('diary.macros.carbs')}
        planned={totals.carbsG}
        target={goal?.carbs_g != null && goal.carbs_g > 0 ? goal.carbs_g : null}
        unit="g"
        color={colors.macroCarbs}
      />
      <MetricRow
        label={t('diary.macros.fat')}
        planned={totals.fatG}
        target={goal?.fat_g != null && goal.fat_g > 0 ? goal.fat_g : null}
        unit="g"
        color={colors.macroFat}
      />

      {!hasAnyTarget ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/goals' as Href)}
          hitSlop={4}
        >
          <Text variant="caption" tone="brand">
            {t('mealPlan.setGoalCta')}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
