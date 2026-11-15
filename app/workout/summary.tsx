import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useWorkoutDetail } from '@/features/workout/hooks';
import { formatWorkoutDay, resolveWorkoutName } from '@/features/workout/session-display';
import { fonts } from '@/theme/fonts';
import { spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{
    id?: string;
    prs?: string;
    estimated?: string;
    volume?: string;
    durationMin?: string;
    intensity?: string;
  }>();
  const detail = useWorkoutDetail(params.id ?? null);

  const estimated = Number(params.estimated ?? detail.data?.estimated_calories ?? 0);
  const durationMin = Number(
    params.durationMin ?? Math.round((detail.data?.active_duration_sec ?? 0) / 60) ?? 0,
  );
  const volume = Number(params.volume ?? 0);
  const personalRecords = useMemo(() => {
    if (!params.prs) return [];
    try {
      const parsed = JSON.parse(params.prs) as {
        exerciseName: string;
        kind: string;
        value: number;
        previous: number | null;
      }[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [params.prs]);
  const exerciseCount = detail.data?.exercises.length ?? 0;
  const setCount =
    detail.data?.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) ?? 0;

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View style={{ gap: spacing[1] }}>
          <Text variant="headingLarge">{t('workout.summaryTitle')}</Text>
          <Text variant="bodySmall" tone="secondary">
            {t('workout.summarySubtitle')}
          </Text>
        </View>

        <Card style={{ gap: spacing[3], alignItems: 'center', paddingVertical: spacing[5] }}>
          <Text variant="headingSmall" style={{ textAlign: 'center' }} numberOfLines={2}>
            {resolveWorkoutName(detail.data?.name, t('workout.defaultName'))}
          </Text>
          {detail.data?.started_at ? (
            <Text variant="caption" tone="secondary">
              {formatWorkoutDay(detail.data.started_at)}
            </Text>
          ) : null}
          <Text
            tone="brand"
            style={{ fontFamily: fonts.monoBold, fontSize: 44, lineHeight: 50 }}
          >
            {Math.round(estimated)}
          </Text>
          <Text variant="label" tone="secondary">
            {t('workout.estimatedActiveCalories')}
          </Text>
          <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
            {t('workout.sessionCaloriesSumNote')}
          </Text>
        </Card>

        <Card style={{ gap: 0, paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' }}>
          <SummaryStat
            label={t('workout.summaryDuration', { value: durationMin })}
            borderColor={colors.border}
          />
          <SummaryStat
            label={t('workout.summaryVolume', { value: volume })}
            borderColor={colors.border}
          />
          <SummaryStat
            label={t('workout.summaryCounts', { exercises: exerciseCount, sets: setCount })}
            last
          />
        </Card>

        {personalRecords.length ? (
          <Card style={{ gap: spacing[2] }}>
            <Text variant="label" tone="secondary">
              {t('phase1.prTitle')}
            </Text>
            {personalRecords.map((record, index) => (
              <Text key={`${record.exerciseName}-${record.kind}-${index}`} variant="bodyStrong">
                {t('phase1.prLine', {
                  name: record.exerciseName,
                  kind: t(`phase1.kindLabel.${record.kind}`),
                  value: record.value,
                })}
              </Text>
            ))}
          </Card>
        ) : null}

        <Button
          label={t('workout.viewHistory')}
          onPress={() => {
            if (params.id) {
              router.replace({ pathname: '/workout/[id]', params: { id: params.id } });
            } else {
              router.replace('/workout/history');
            }
          }}
        />
        <Button
          label={t('workout.backToWorkouts')}
          variant="secondary"
          onPress={() => router.replace('/(tabs)/workout')}
        />
      </View>
    </Screen>
  );
}

function SummaryStat({
  label,
  borderColor,
  last = false,
}: {
  label: string;
  borderColor?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: borderColor,
      }}
    >
      <Text variant="body">{label}</Text>
    </View>
  );
}
