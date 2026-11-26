import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { MealSection } from '@/features/diary/components/meal-section';
import {
  NutritionDashboard,
  type DiaryPeriod,
} from '@/features/diary/components/nutrition-dashboard';
import { WeekFoodList } from '@/features/diary/components/week-food-list';
import { WorkoutSection } from '@/features/diary/components/workout-section';
import { HydrationCard } from '@/features/hydration/hydration-card';
import { MEAL_ORDER, weekDateKeys } from '@/features/diary/aggregations';
import type { MacroTotals } from '@/features/diary/balance';
import type { FoodEntry } from '@/features/food/types';
import type { Goal, Profile } from '@/features/goals/types';
import { usePlannedMealsForDate } from '@/features/meal-plan/hooks';
import { MealPlanPreviewCard } from '@/features/meal-plan/meal-plan-preview-card';
import { TodayGuidanceCard } from '@/features/companion/components/today-guidance-card';
import type { WorkoutListItem } from '@/features/workout/hooks';

type DiaryDayViewProps = {
  dateKey: string;
  todayKey: string;
  locale: string;
  goal: Goal | null | undefined;
  profile: Profile | null | undefined;
  weightKg: number | null;
  entries: FoodEntry[];
  totals: MacroTotals;
  burned: number;
  workouts: WorkoutListItem[];
  onDeleteEntry: (id: string) => void;
};

export function DiaryDayView({
  dateKey,
  todayKey,
  locale,
  goal,
  profile,
  weightKg,
  entries,
  burned,
  workouts,
  onDeleteEntry,
}: DiaryDayViewProps) {
  const [period, setPeriod] = useState<DiaryPeriod>('day');
  const weekKeys = useMemo(() => weekDateKeys(dateKey), [dateKey]);
  const initialOpen = weekKeys.includes(todayKey) ? todayKey : weekKeys[0]!;
  const [weekOpenKey, setWeekOpenKey] = useState<string | null>(initialOpen);
  const planned = usePlannedMealsForDate(dateKey);

  return (
    <View className="gap-4">
      <TodayGuidanceCard
        dateKey={dateKey}
        todayKey={todayKey}
        entries={entries}
        workouts={workouts}
      />
      <NutritionDashboard
        dateKey={dateKey}
        todayKey={todayKey}
        locale={locale}
        period={period}
        onPeriodChange={setPeriod}
        goal={goal}
        profile={profile}
        weightKg={weightKg}
        dayEntries={entries}
        dayBurned={burned}
      />

      <MealPlanPreviewCard
        dateKey={dateKey}
        meals={planned.data ?? []}
        isLoading={planned.isLoading}
        isError={Boolean(planned.error)}
      />

      {period === 'week' ? (
        <WeekFoodList
          dateKey={dateKey}
          todayKey={todayKey}
          locale={locale}
          openKey={weekOpenKey}
          onOpenKeyChange={setWeekOpenKey}
        />
      ) : (
        <>
          {MEAL_ORDER.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              dateKey={dateKey}
              entries={entries.filter((entry) => entry.meal_type === meal)}
              onAdd={() =>
                router.push({
                  pathname: '/food/add',
                  params: { intent: 'log', date: dateKey, meal },
                })
              }
              onDelete={onDeleteEntry}
            />
          ))}
          <HydrationCard dateKey={dateKey} />
          <WorkoutSection
            workouts={workouts}
            locale={locale}
            onAdd={() => router.push('/(tabs)/workout')}
          />
        </>
      )}
    </View>
  );
}
