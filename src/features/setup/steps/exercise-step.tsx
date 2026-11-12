import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import type { ExerciseType, Intensity } from '@/features/setup/calculations';
import { SelectionCard } from '@/features/setup/selection-card';
import { useSetup } from '@/features/setup/setup-provider';
import { SetupShell } from '@/features/setup/setup-shell';

const TYPES: ExerciseType[] = ['strength', 'cardio', 'sports', 'mixed', 'other'];
const INTENSITIES: Intensity[] = ['easy', 'moderate', 'hard'];

export function ExerciseStep() {
  const { t } = useTranslation();
  const { answers, progress, goNext, goBack, saving, error } = useSetup();
  const [sessions, setSessions] = useState<number | null>(answers.sessionsPerWeek);
  const [type, setType] = useState<ExerciseType | null>(
    answers.sessionsPerWeek === 0 ? 'none' : answers.exerciseType,
  );
  const [typeOther, setTypeOther] = useState(answers.exerciseTypeOther ?? '');
  const [minutes, setMinutes] = useState(
    answers.sessionMinutes != null ? String(answers.sessionMinutes) : '',
  );
  const [intensity, setIntensity] = useState<Intensity | null>(answers.intensity);
  const [touched, setTouched] = useState(false);

  const sessionOptions = useMemo(
    () => [
      { value: '0', label: t('setup.exercise.sessionsNone') },
      ...[1, 2, 3, 4, 5].map((count) => ({
        value: String(count),
        label: t('setup.exercise.sessionsCount', { count }),
      })),
      { value: '6', label: t('setup.exercise.sessionsSixPlus') },
    ],
    [t],
  );

  const noExercise = sessions === 0 || type === 'none';
  const minutesNum = Number(minutes);
  const detailsOk =
    type != null &&
    Number.isFinite(minutesNum) &&
    minutesNum >= 10 &&
    intensity != null;
  const valid = sessions != null && (noExercise || detailsOk);

  return (
    <SetupShell
      title={t('setup.exercise.title')}
      subtitle={t('setup.exercise.subtitle')}
      stepIndex={progress.index}
      stepTotal={progress.total}
      onBack={() => void goBack()}
      continueDisabled={saving}
      continueLoading={saving}
      onContinue={() => {
        setTouched(true);
        if (!valid || sessions == null) return;
        const none = sessions === 0 || type === 'none';
        void goNext({
          sessionsPerWeek: sessions,
          exerciseType: none ? 'none' : type,
          exerciseTypeOther:
            !none && type === 'other' ? typeOther.trim() || null : null,
          sessionMinutes: none ? 0 : minutesNum,
          intensity: none ? null : intensity,
        });
      }}
    >
      <View className="gap-4">
        <Select
          label={t('setup.exercise.sessionsLabel')}
          value={sessions == null ? null : String(sessions)}
          options={sessionOptions}
          placeholder={t('setup.exercise.sessionsPlaceholder')}
          onChange={(value) => {
            const count = Number(value);
            setSessions(count);
            if (count === 0) {
              setType('none');
            } else if (type === 'none') {
              setType('mixed');
            }
          }}
          error={touched && sessions == null ? t('setup.exercise.sessionsError') : undefined}
        />

        {!noExercise ? (
          <>
            <View className="gap-2">
              <Text variant="label" tone="secondary">
                {t('setup.exercise.typeLabel')}
              </Text>
              {TYPES.map((value) => (
                <SelectionCard
                  key={value}
                  label={t(
                    value === 'strength'
                      ? 'setup.exercise.typeStrength'
                      : value === 'cardio'
                        ? 'setup.exercise.typeCardio'
                        : value === 'sports'
                          ? 'setup.exercise.typeSports'
                          : value === 'mixed'
                            ? 'setup.exercise.typeMixed'
                            : 'setup.exercise.typeOther',
                  )}
                  selected={type === value}
                  onPress={() => setType(value)}
                />
              ))}
            </View>

            {type === 'other' ? (
              <Input
                label={t('setup.exercise.otherLabel')}
                value={typeOther}
                onChangeText={setTypeOther}
                placeholder={t('setup.exercise.otherPlaceholder')}
                autoCapitalize="sentences"
              />
            ) : null}

            <Input
              label={t('setup.exercise.minutesLabel')}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              placeholder={t('setup.exercise.minutesPlaceholder')}
            />

            <View className="gap-2">
              <Text variant="label" tone="secondary">
                {t('setup.exercise.intensityLabel')}
              </Text>
              {INTENSITIES.map((value) => (
                <SelectionCard
                  key={value}
                  label={t(
                    value === 'easy'
                      ? 'setup.exercise.intensityEasy'
                      : value === 'moderate'
                        ? 'setup.exercise.intensityModerate'
                        : 'setup.exercise.intensityHard',
                  )}
                  description={t(
                    value === 'easy'
                      ? 'setup.exercise.intensityEasyDesc'
                      : value === 'moderate'
                        ? 'setup.exercise.intensityModerateDesc'
                        : 'setup.exercise.intensityHardDesc',
                  )}
                  selected={intensity === value}
                  onPress={() => setIntensity(value)}
                />
              ))}
            </View>
          </>
        ) : (
          <Text variant="bodySmall" tone="muted">
            {t('setup.exercise.noExerciseNote')}
          </Text>
        )}

        {touched && !valid ? (
          <Text variant="caption" tone="error">
            {t('setup.exercise.detailsError')}
          </Text>
        ) : null}
        {error ? (
          <Text variant="caption" tone="error">
            {error}
          </Text>
        ) : null}
      </View>
    </SetupShell>
  );
}
