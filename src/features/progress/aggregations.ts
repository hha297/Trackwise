import {
  entriesToMacros,
  groupEntriesByDate,
  groupWorkoutsByDate,
  workoutDurationMinutes,
} from '@/features/diary/aggregations';
import { classifyDayCalories } from '@/features/diary/goal-status';
import type { FoodEntry } from '@/features/food/types';
import type { Goal } from '@/features/goals/types';
import type { BodyMeasurement } from '@/features/measurements/hooks';
import {
  deriveBodyComposition,
  NAVY_COMPOSITION_METHOD,
} from '@/features/measurements/navy-body-fat';
import {
  trendBucketMode,
  trendSourceBuckets,
  type TrendBucketMode,
} from '@/features/progress/period';
import type { BodyMetricKey, ProgressPeriod } from '@/features/progress/types';
import type { WorkoutListItem } from '@/features/workout/types';

const MIN_DAYS_FOR_ADHERENCE = 3;
const MIN_POINTS_FOR_CHANGE = 2;

export type ProgressOverview = {
  avgCalories: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  daysWithFood: number;
  workoutSessions: number;
  workoutDays: number;
  estWorkoutKcal: number | null;
  totalWorkoutMinutes: number;
  weightChangeKg: number | null;
  bodyFatChangePct: number | null;
  /** Share of completed logged days within calorie tolerance; null when too little data. */
  goalAdherencePct: number | null;
  daysOnTarget: number;
  completedFoodDays: number;
};

export type ChartBucket = {
  key: string;
  label: string;
  value: number | null;
};

export type NutritionTrendSeries = {
  buckets: ChartBucket[];
  calories: (number | null)[];
  protein: (number | null)[];
  carbs: (number | null)[];
  fat: (number | null)[];
  mode: TrendBucketMode;
};

export type WorkoutTrendSummary = {
  sessions: number;
  workoutDays: number;
  frequencyPerWeek: number | null;
  estBurnKcal: number | null;
  totalMinutes: number;
  sessionBars: ChartBucket[];
};

export type BodyPointSource = 'measured' | 'estimated' | 'derived';

export type BodyMetricPoint = {
  measuredOn: string;
  value: number;
  source: BodyPointSource;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function firstLastChange(values: number[]): number | null {
  if (values.length < MIN_POINTS_FOR_CHANGE) return null;
  return round2(values[values.length - 1]! - values[0]!);
}

export function filterMeasurementsInRange(
  rows: BodyMeasurement[],
  startKey: string,
  endKey: string,
): BodyMeasurement[] {
  return rows
    .filter((row) => row.measured_on >= startKey && row.measured_on <= endKey)
    .slice()
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on));
}

export function buildProgressOverview(input: {
  dayKeys: string[];
  todayKey: string;
  entries: FoodEntry[];
  workouts: WorkoutListItem[];
  measurements: BodyMeasurement[];
  goal: Goal | null | undefined;
}): ProgressOverview {
  const entriesByDate = groupEntriesByDate(input.entries);
  const workoutsByDate = groupWorkoutsByDate(input.workouts);
  const calorieTarget = input.goal?.daily_calorie_target;

  let daysWithFood = 0;
  let sumCal = 0;
  let sumP = 0;
  let sumC = 0;
  let sumF = 0;
  let workoutDays = 0;
  let totalWorkoutMinutes = 0;
  let totalWorkoutCalories = 0;
  let daysOnTarget = 0;
  let completedFoodDays = 0;

  for (const key of input.dayKeys) {
    if (key > input.todayKey) continue;
    const dayEntries = entriesByDate.get(key) ?? [];
    const dayWorkouts = workoutsByDate.get(key) ?? [];

    if (dayWorkouts.length) {
      workoutDays += 1;
      totalWorkoutMinutes += dayWorkouts.reduce((sum, w) => sum + workoutDurationMinutes(w), 0);
      totalWorkoutCalories += dayWorkouts.reduce(
        (sum, w) => sum + Number(w.estimated_calories ?? 0),
        0,
      );
    }

    if (!dayEntries.length) continue;
    daysWithFood += 1;
    const macros = entriesToMacros(dayEntries);
    sumCal += macros.calories;
    sumP += macros.proteinG;
    sumC += macros.carbsG;
    sumF += macros.fatG;

    if (calorieTarget == null || key >= input.todayKey) continue;
    completedFoodDays += 1;
    const status = classifyDayCalories({
      consumed: macros.calories,
      target: calorieTarget,
      dateKey: key,
      todayKey: input.todayKey,
      hasFoodLogs: true,
    });
    if (status === 'achieved') daysOnTarget += 1;
  }

  const weights = filterMeasurementsInRange(
    input.measurements,
    input.dayKeys[0]!,
    input.dayKeys[input.dayKeys.length - 1]!,
  )
    .map((row) => row.weight_kg)
    .filter((v): v is number => v != null);

  const bodyFats = filterMeasurementsInRange(
    input.measurements,
    input.dayKeys[0]!,
    input.dayKeys[input.dayKeys.length - 1]!,
  )
    .map((row) => row.body_fat_percent)
    .filter((v): v is number => v != null);

  const n = daysWithFood;
  const goalAdherencePct =
    calorieTarget != null && completedFoodDays >= MIN_DAYS_FOR_ADHERENCE
      ? Math.round((daysOnTarget / completedFoodDays) * 100)
      : null;

  return {
    avgCalories: n > 0 ? Math.round(sumCal / n) : null,
    avgProtein: n > 0 ? Math.round(sumP / n) : null,
    avgCarbs: n > 0 ? Math.round(sumC / n) : null,
    avgFat: n > 0 ? Math.round(sumF / n) : null,
    daysWithFood,
    workoutSessions: input.workouts.length,
    workoutDays,
    estWorkoutKcal:
      input.workouts.length > 0 ? Math.round(totalWorkoutCalories) : null,
    totalWorkoutMinutes,
    weightChangeKg: firstLastChange(weights),
    bodyFatChangePct: firstLastChange(bodyFats),
    goalAdherencePct,
    daysOnTarget,
    completedFoodDays,
  };
}

function formatBucketLabel(
  key: string,
  mode: TrendBucketMode,
  period: ProgressPeriod,
  shortDayFmt: Intl.DateTimeFormat,
  shortDateFmt: Intl.DateTimeFormat,
  compactDateFmt: Intl.DateTimeFormat,
): string {
  const date = new Date(`${key}T12:00:00`);
  if (mode === 'daily') {
    // 7-day: weekday. Longer ranges: day-of-month only (fits dense habit-strip ticks).
    if (period === 7) {
      return shortDayFmt.format(date).replace(/\.$/, '');
    }
    return String(date.getDate());
  }
  if (mode === 'biweekly') {
    return compactDateFmt.format(date);
  }
  return shortDateFmt.format(date);
}

export function buildNutritionTrends(input: {
  period: ProgressPeriod;
  dayKeys: string[];
  todayKey: string;
  entries: FoodEntry[];
  locale: string;
}): NutritionTrendSeries {
  const entriesByDate = groupEntriesByDate(input.entries);
  const mode = trendBucketMode(input.period);
  const shortDayFmt = new Intl.DateTimeFormat(input.locale, { weekday: 'short' });
  const shortDateFmt = new Intl.DateTimeFormat(input.locale, { month: 'short', day: 'numeric' });
  const compactDateFmt = new Intl.DateTimeFormat(input.locale, {
    month: 'numeric',
    day: 'numeric',
  });

  const sourceBuckets = trendSourceBuckets(input.period, input.dayKeys);

  const buckets: ChartBucket[] = [];
  const calories: (number | null)[] = [];
  const protein: (number | null)[] = [];
  const carbs: (number | null)[] = [];
  const fat: (number | null)[] = [];

  for (const bucket of sourceBuckets) {
    let daysWithFood = 0;
    let sumCal = 0;
    let sumP = 0;
    let sumC = 0;
    let sumF = 0;

    for (const dayKey of bucket.dayKeys) {
      if (dayKey > input.todayKey) continue;
      const list = entriesByDate.get(dayKey) ?? [];
      if (!list.length) continue;
      daysWithFood += 1;
      const macros = entriesToMacros(list);
      sumCal += macros.calories;
      sumP += macros.proteinG;
      sumC += macros.carbsG;
      sumF += macros.fatG;
    }

    const label = formatBucketLabel(
      bucket.key,
      mode,
      input.period,
      shortDayFmt,
      shortDateFmt,
      compactDateFmt,
    );
    if (daysWithFood === 0) {
      buckets.push({ key: bucket.key, label, value: null });
      calories.push(null);
      protein.push(null);
      carbs.push(null);
      fat.push(null);
      continue;
    }

    const avgCal = Math.round(sumCal / daysWithFood);
    buckets.push({ key: bucket.key, label, value: avgCal });
    calories.push(avgCal);
    protein.push(Math.round(sumP / daysWithFood));
    carbs.push(Math.round(sumC / daysWithFood));
    fat.push(Math.round(sumF / daysWithFood));
  }

  return { buckets, calories, protein, carbs, fat, mode };
}

export function buildWorkoutTrends(input: {
  period: ProgressPeriod;
  dayKeys: string[];
  todayKey: string;
  workouts: WorkoutListItem[];
  locale: string;
}): WorkoutTrendSummary {
  const workoutsByDate = groupWorkoutsByDate(input.workouts);
  const mode = trendBucketMode(input.period);
  const shortDayFmt = new Intl.DateTimeFormat(input.locale, { weekday: 'short' });
  const shortDateFmt = new Intl.DateTimeFormat(input.locale, { month: 'short', day: 'numeric' });
  const compactDateFmt = new Intl.DateTimeFormat(input.locale, {
    month: 'numeric',
    day: 'numeric',
  });
  const sourceBuckets = trendSourceBuckets(input.period, input.dayKeys);

  let totalMinutes = 0;
  let totalCalories = 0;
  let workoutDays = 0;

  for (const key of input.dayKeys) {
    if (key > input.todayKey) continue;
    const dayWorkouts = workoutsByDate.get(key) ?? [];
    if (!dayWorkouts.length) continue;
    workoutDays += 1;
    totalMinutes += dayWorkouts.reduce((sum, w) => sum + workoutDurationMinutes(w), 0);
    totalCalories += dayWorkouts.reduce((sum, w) => sum + Number(w.estimated_calories ?? 0), 0);
  }

  const sessionBars: ChartBucket[] = sourceBuckets.map((bucket) => {
    let sessions = 0;
    for (const dayKey of bucket.dayKeys) {
      if (dayKey > input.todayKey) continue;
      sessions += (workoutsByDate.get(dayKey) ?? []).length;
    }
    return {
      key: bucket.key,
      label: formatBucketLabel(
        bucket.key,
        mode,
        input.period,
        shortDayFmt,
        shortDateFmt,
        compactDateFmt,
      ),
      value: sessions > 0 ? sessions : null,
    };
  });

  const weeks = Math.max(1, input.period / 7);
  const frequencyPerWeek =
    input.workouts.length > 0 ? round1(input.workouts.length / weeks) : null;

  return {
    sessions: input.workouts.length,
    workoutDays,
    frequencyPerWeek,
    estBurnKcal: input.workouts.length > 0 ? Math.round(totalCalories) : null,
    totalMinutes,
    sessionBars,
  };
}

function compositionSource(
  method: BodyMeasurement['composition_method'],
  derivedFromNavy: boolean,
): BodyPointSource {
  if (derivedFromNavy || method === NAVY_COMPOSITION_METHOD) return 'estimated';
  return 'measured';
}

export function resolveBodyMetricValue(
  row: BodyMeasurement,
  metric: BodyMetricKey,
  profile?: { sex?: string | null; heightCm?: number | null } | null,
): BodyMetricPoint | null {
  const direct = row[metric];
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    const source =
      metric === 'body_fat_percent' || metric === 'fat_mass_kg' || metric === 'lean_mass_kg'
        ? compositionSource(row.composition_method, false)
        : 'measured';
    return { measuredOn: row.measured_on, value: direct, source };
  }

  if (metric === 'fat_mass_kg' || metric === 'lean_mass_kg') {
    if (row.weight_kg != null && row.body_fat_percent != null) {
      const fat = round2((row.weight_kg * row.body_fat_percent) / 100);
      const lean = round2(row.weight_kg - fat);
      return {
        measuredOn: row.measured_on,
        value: metric === 'fat_mass_kg' ? fat : lean,
        source: compositionSource(row.composition_method, false) === 'estimated' ? 'estimated' : 'derived',
      };
    }
  }

  if (
    (metric === 'body_fat_percent' || metric === 'fat_mass_kg' || metric === 'lean_mass_kg') &&
    profile
  ) {
    const navy = deriveBodyComposition({
      sex: profile.sex,
      heightCm: profile.heightCm,
      weightKg: row.weight_kg,
      neckCm: row.neck_cm,
      waistCm: row.waist_cm,
      hipCm: row.hip_cm,
    });
    if (!navy.ok) return null;
    const value =
      metric === 'body_fat_percent'
        ? navy.bodyFatPercent
        : metric === 'fat_mass_kg'
          ? navy.fatMassKg
          : navy.leanMassKg;
    return { measuredOn: row.measured_on, value, source: 'estimated' };
  }

  return null;
}

export function buildBodyMetricSeries(input: {
  measurements: BodyMeasurement[];
  startKey: string;
  endKey: string;
  metric: BodyMetricKey;
  profile?: { sex?: string | null; heightCm?: number | null } | null;
}): {
  points: BodyMetricPoint[];
  change: number | null;
  hasEstimated: boolean;
  hasMeasured: boolean;
} {
  const rows = filterMeasurementsInRange(input.measurements, input.startKey, input.endKey);
  const points: BodyMetricPoint[] = [];
  for (const row of rows) {
    const point = resolveBodyMetricValue(row, input.metric, input.profile);
    if (point) points.push(point);
  }
  return {
    points,
    change: firstLastChange(points.map((p) => p.value)),
    hasEstimated: points.some((p) => p.source === 'estimated'),
    hasMeasured: points.some((p) => p.source === 'measured' || p.source === 'derived'),
  };
}
