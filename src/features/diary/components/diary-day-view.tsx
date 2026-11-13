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
import { StreakOverview } from '@/features/engagement/streak-overview';
import { HydrationCard } from '@/features/hydration/hydration-card';
import { MEAL_ORDER, weekDateKeys } from '@/features/diary/aggregations';
import type { MacroTotals } from '@/features/diary/balance';
import type { FoodEntry } from '@/features/food/types';
import type { Goal, Profile } from '@/features/goals/types';
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

  return (
    <View className="gap-4">
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

      <StreakOverview todayKey={todayKey} />

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
                router.push({ pathname: '/food/add', params: { date: dateKey, meal } })
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
