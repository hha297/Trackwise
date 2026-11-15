import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { BarChart } from '@/features/diary/components/charts/bar-chart';
import { LineChart } from '@/features/diary/components/charts/line-chart';
import type { NutritionTrendSeries } from '@/features/progress/aggregations';
import { StatRow } from '@/features/progress/components/metric-tile';
import type { Goal } from '@/features/goals/types';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type NutritionTrendsSectionProps = {
  series: NutritionTrendSeries;
  avgCalories: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  goal: Goal | null | undefined;
};

export function NutritionTrendsSection({
  series,
  avgCalories,
  avgProtein,
  avgCarbs,
  avgFat,
  goal,
}: NutritionTrendsSectionProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="headingSmall">{t('progress.nutrition.title')}</Text>
        <Text variant="caption" tone="secondary">
          {t('progress.nutrition.dailyNote')}
        </Text>
      </View>

      <View style={styles.chartBlock}>
        <Text variant="label" tone="secondary">
          {t('progress.nutrition.calories')}
        </Text>
        <BarChart
          items={series.buckets}
          target={goal?.daily_calorie_target ?? null}
          height={156}
          emptyLabel={t('progress.nutrition.noData')}
        />
      </View>

      <View style={styles.chartBlock}>
        <Text variant="label" tone="secondary">
          {t('progress.nutrition.macros')}
        </Text>
        <LineChart
          labels={series.buckets.map((b) => b.label)}
          height={168}
          emptyLabel={t('progress.nutrition.noData')}
          series={[
            {
              key: t('diary.macros.protein'),
              color: colors.macroProtein,
              values: series.protein,
            },
            {
              key: t('diary.macros.carbs'),
              color: colors.macroCarbs,
              values: series.carbs,
            },
            {
              key: t('diary.macros.fat'),
              color: colors.macroFat,
              values: series.fat,
            },
          ]}
        />
      </View>

      <View style={styles.averages}>
        <Text variant="label" tone="secondary">
          {t('progress.nutrition.averages')}
        </Text>
        <StatRow
          label={t('progress.overview.avgCalories')}
          value={
            avgCalories != null
              ? goal?.daily_calorie_target != null
                ? `${avgCalories} / ${Math.round(goal.daily_calorie_target)} kcal`
                : `${avgCalories} kcal`
              : '—'
          }
        />
        <StatRow
          label={t('diary.macros.protein')}
          value={
            avgProtein != null
              ? goal?.protein_g != null
                ? `${avgProtein} / ${Math.round(goal.protein_g)} g`
                : `${avgProtein} g`
              : '—'
          }
        />
        <StatRow
          label={t('diary.macros.carbs')}
          value={
            avgCarbs != null
              ? goal?.carbs_g != null
                ? `${avgCarbs} / ${Math.round(goal.carbs_g)} g`
                : `${avgCarbs} g`
              : '—'
          }
        />
        <StatRow
          label={t('diary.macros.fat')}
          value={
            avgFat != null
              ? goal?.fat_g != null
                ? `${avgFat} / ${Math.round(goal.fat_g)} g`
                : `${avgFat} g`
              : '—'
          }
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[4],
  },
  header: {
    gap: spacing[1],
  },
  chartBlock: {
    gap: spacing[2],
  },
  averages: {
    gap: spacing[2],
  },
});
