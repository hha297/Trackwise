import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-provider';
import { useProfile } from '@/features/goals/hooks';
import { formatWeight } from '@/features/setup/units';
import { WorkoutFilterChip } from '@/features/workout/components/workout-filter-chip';
import { fetchCompletedSetHistory } from '@/features/workout/history-sets';
import { recordsFromSets } from '@/features/workout/personal-records';
import {
  aggregateExerciseSessions,
  compareLastSessions,
  filterSessions,
  suggestProgression,
} from '@/features/workout/progression';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export default function ExerciseProgressScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { session } = useAuth();
  const profile = useProfile();
  const units = profile.data?.units === 'imperial' ? 'imperial' : 'metric';
  const [range, setRange] = useState<'4' | '12' | 'all'>('12');
  const userId = session?.user.id;
  const history = useQuery({
    queryKey: ['exercise-history', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchCompletedSetHistory(userId!),
  });

  const sets = useMemo(
    () => (history.data ?? []).filter((set) => set.exerciseKey === id || set.exerciseName === name),
    [history.data, id, name],
  );
  const points = filterSessions(aggregateExerciseSessions(sets), range);
  const suggestion = suggestProgression(aggregateExerciseSessions(sets), sets[0]?.exerciseType ?? 'strength');
  const record = recordsFromSets(sets)[0];
  const delta = compareLastSessions(points);
  const maxVolume = Math.max(1, ...points.map((point) => point.volumeKg));

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-4">
        <Text variant="headingLarge">{name || t('phase1.progressTitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {(['4', '12', 'all'] as const).map((item) => (
            <WorkoutFilterChip
              key={item}
              label={t(`phase1.range.${item}`)}
              selected={range === item}
              onPress={() => setRange(item)}
            />
          ))}
        </View>
        {history.isLoading ? <LoadingState /> : null}
        {history.isError ? (
          <ErrorState title={t('phase1.loadError')} body={t('workout.retry')} onRetry={() => void history.refetch()} />
        ) : null}
        {!history.isLoading && points.length === 0 ? (
          <Text variant="bodySmall" tone="secondary">{t('phase1.noHistory')}</Text>
        ) : null}
        {record ? (
          <Card className="gap-1">
            <Text variant="label" tone="secondary">{t('phase1.prTitle')}</Text>
            {record.bestWeightKg != null ? (
              <Text variant="body">{t('phase1.prWeight', { value: formatWeight(record.bestWeightKg, units) })}</Text>
            ) : null}
            {record.bestReps != null ? <Text variant="body">{t('phase1.prReps', { value: record.bestReps })}</Text> : null}
            {record.bestE1rmKg != null ? (
              <Text variant="body">{t('phase1.prE1rm', { value: formatWeight(record.bestE1rmKg, units) })}</Text>
            ) : null}
            {record.bestSessionVolumeKg != null ? (
              <Text variant="body">{t('phase1.prVolume', { value: `${record.bestSessionVolumeKg} kg` })}</Text>
            ) : null}
          </Card>
        ) : null}
        <Card className="gap-2">
          <Text variant="label" tone="secondary">{t('phase1.volume')}</Text>
          {points.map((point) => (
            <View key={point.sessionId} className="gap-1">
              <Text variant="caption" tone="secondary">
                {point.dateKey}
                {point.maxWeightKg != null ? ` · ${formatWeight(point.maxWeightKg, units)}` : ''}
                {point.maxReps != null ? ` · ${point.maxReps}` : ''}
              </Text>
              <View style={{ height: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted }}>
                <View
                  style={{
                    width: `${Math.max(4, Math.round((point.volumeKg / maxVolume) * 100))}%`,
                    height: 8,
                    borderRadius: radii.pill,
                    backgroundColor: colors.primary,
                  }}
                />
              </View>
            </View>
          ))}
        </Card>
        {delta ? (
          <Text variant="caption" tone="secondary">
            {t('phase1.compare', {
              weight: delta.weightDeltaKg ?? '—',
              reps: delta.repsDelta ?? '—',
              volume: delta.volumeDeltaKg ?? '—',
            })}
          </Text>
        ) : null}
        <Text variant="bodySmall" tone="secondary">
          {suggestion.kind === 'add_weight'
            ? t('phase1.suggestWeight', { amount: suggestion.amountKg })
            : suggestion.kind === 'add_reps'
              ? t('phase1.suggestReps', { amount: suggestion.amount })
              : t(`phase1.suggest.${suggestion.reason}`)}
        </Text>
      </View>
    </Screen>
  );
}
