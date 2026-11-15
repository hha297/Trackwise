import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { MEAL_ORDER } from '@/features/diary/aggregations';
import { isMealType, parseMealType } from '@/features/food/picker-intent';
import type { MealType } from '@/features/food/types';
import { useActiveGoal } from '@/features/goals/hooks';
import {
  plannedMealsForMeal,
  roundPlannedTotals,
  sumPlannedMacros,
} from '@/features/meal-plan/aggregations';
import { dayStripKeys, resolveMealPlanDate, shiftDay } from '@/features/meal-plan/date-nav';
import { usePlannedMealMutations, useWeekPlannedMeals } from '@/features/meal-plan/hooks';
import { MealPlanSection } from '@/features/meal-plan/meal-plan-section';
import { PlannedMealRow } from '@/features/meal-plan/planned-meal-row';
import { PlannedNutritionOverview } from '@/features/meal-plan/planned-nutrition-overview';
import type { PlannedMeal } from '@/features/meal-plan/types';
import { useAppLanguage } from '@/i18n';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { formatDiaryHeading, parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

export default function MealPlanScreen() {
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const initialDate = resolveMealPlanDate(
    typeof params.date === 'string' ? params.date : undefined,
  );
  const focusMeal = isMealType(typeof params.meal === 'string' ? params.meal : undefined)
    ? parseMealType(params.meal)
    : null;
  const sessionKey = `${initialDate}:${focusMeal ?? ''}:${typeof params.meal === 'string' ? params.meal : ''}`;

  return (
    <MealPlanBody key={sessionKey} initialDate={initialDate} focusMeal={focusMeal} />
  );
}

function MealPlanBody({
  initialDate,
  focusMeal,
}: {
  initialDate: string;
  focusMeal: MealType | null;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const locale = useAppLanguage();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [highlightMeal, setHighlightMeal] = useState<MealType | null>(focusMeal);

  const today = toDiaryDateKey();
  const stripDays = dayStripKeys(selectedDate);
  const plans = useWeekPlannedMeals(selectedDate);
  const goal = useActiveGoal();
  const mutations = usePlannedMealMutations();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  const dayMeals = useMemo(
    () => (plans.data ?? []).filter((meal) => meal.plan_date === selectedDate),
    [plans.data, selectedDate],
  );
  const dayTotals = roundPlannedTotals(sumPlannedMacros(dayMeals));

  function selectDay(day: string) {
    setSelectedDate(day);
    setHighlightMeal(null);
  }

  function openAddForMeal(meal: MealType) {
    router.push({
      pathname: '/food/add',
      params: {
        intent: 'plan',
        source: 'foods',
        date: selectedDate,
        meal,
      },
    });
  }

  async function updateServings(
    meal: PlannedMeal,
    nextServings: number,
    macros: { calories: number; proteinG: number; carbsG: number; fatG: number },
  ) {
    await mutations.update.mutateAsync({
      id: meal.id,
      planDate: meal.plan_date,
      mealType: meal.meal_type,
      recipeId: meal.recipe_id,
      title: meal.title,
      notes: meal.notes,
      servings: nextServings,
      calories: macros.calories,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
    });
  }

  return (
    <Screen scroll={false} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[8] }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('mealPlan.title')}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text variant="bodyStrong" tone="brand">
              {t('common.close')}
            </Text>
          </Pressable>
        </View>
        <Text variant="bodySmall" tone="secondary">
          {t('mealPlan.subtitle')}
        </Text>

        <View className="flex-row items-center justify-between gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mealPlan.prevDay')}
            onPress={() => selectDay(shiftDay(selectedDate, -1))}
            hitSlop={8}
          >
            <ChevronLeft size={22} color={colors.textPrimary} />
          </Pressable>
          <View className="min-w-0 flex-1 items-center gap-1">
            <Text variant="bodyStrong" numberOfLines={1}>
              {formatDiaryHeading(selectedDate, locale)}
            </Text>
            {selectedDate !== today ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => selectDay(today)}
                hitSlop={4}
              >
                <Text variant="caption" tone="brand">
                  {t('mealPlan.goToToday')}
                </Text>
              </Pressable>
            ) : (
              <Text variant="caption" tone="muted">
                {t('mealPlan.today')}
              </Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mealPlan.nextDay')}
            onPress={() => selectDay(shiftDay(selectedDate, 1))}
            hitSlop={8}
          >
            <ChevronRight size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View className="flex-row justify-between">
          {stripDays.map((day) => {
            const selected = day === selectedDate;
            const hasPlan = (plans.data ?? []).some((meal) => meal.plan_date === day);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                onPress={() => selectDay(day)}
                style={{ alignItems: 'center', width: 40 }}
              >
                <Text variant="caption" tone="secondary">
                  {weekday.format(parseDiaryDateKey(day)).replace(/\.$/, '')}
                </Text>
                <View
                  style={{
                    marginTop: 6,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? colors.primary : 'transparent',
                    borderWidth: day === today && !selected ? 1.5 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text
                    variant="bodyStrong"
                    style={{ color: selected ? colors.textOnPrimary : colors.textPrimary }}
                  >
                    {parseDiaryDateKey(day).getDate()}
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 4,
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: hasPlan ? colors.primary : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        {plans.isLoading ? <LoadingState /> : null}
        {plans.error ? (
          <ErrorState
            title={t('mealPlan.loadError')}
            body={plans.error instanceof Error ? plans.error.message : t('mealPlan.retry')}
            onRetry={() => void plans.refetch()}
          />
        ) : null}

        <PlannedNutritionOverview totals={dayTotals} goal={goal.data} />

        {MEAL_ORDER.map((meal) => {
          const rows = plannedMealsForMeal(dayMeals, meal);
          return (
            <MealPlanSection
              key={`${meal}:${highlightMeal === meal ? 'focus' : 'idle'}`}
              meal={meal}
              rows={rows}
              highlighted={highlightMeal === meal}
              onAdd={() => openAddForMeal(meal)}
            >
              {rows.map((row) => (
                <PlannedMealRow
                  key={row.id}
                  meal={row}
                  removing={mutations.remove.isPending}
                  onRemove={() => void mutations.remove.mutateAsync(row.id)}
                  onUpdateServings={(next, macros) => void updateServings(row, next, macros)}
                  onOpenRecipe={
                    row.recipe_id
                      ? () =>
                          router.push({
                            pathname: '/food/recipes/[id]',
                            params: {
                              id: row.recipe_id!,
                              intent: 'plan',
                              planDate: selectedDate,
                              meal,
                            },
                          })
                      : undefined
                  }
                />
              ))}
            </MealPlanSection>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
