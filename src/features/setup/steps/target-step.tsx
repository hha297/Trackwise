import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  estimatedWeeksToGoal,
  isTargetCompatibleWithGoal,
  isTargetWithinSafeRange,
  suggestedPaceForGoal,
  weeklyChangeForPace,
  type Pace,
} from '@/features/setup/calculations';
import { SelectionCard } from '@/features/setup/selection-card';
import { useSetup } from '@/features/setup/setup-provider';
import { SetupShell } from '@/features/setup/setup-shell';
import { formatWeight, kgToLb, lbToKg } from '@/features/setup/units';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const PACES: { value: Pace; kg: number }[] = [
  { value: 'slow', kg: 0.25 },
  { value: 'moderate', kg: 0.5 },
  { value: 'fast', kg: 0.75 },
];

export function TargetStep() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { answers, progress, goNext, goBack, saving, error } = useSetup();
  const units = answers.units;
  const currentKg = answers.weightKg ?? 0;
  const suggested = suggestedPaceForGoal(answers.goalType ?? 'lose_weight');

  // Empty by default so the user types their own target (no pre-filled current kg).
  const [targetDisplay, setTargetDisplay] = useState(() => {
    if (answers.targetWeightKg == null) return '';
    const kg = answers.targetWeightKg;
    return units === 'metric'
      ? String(Math.round(kg * 10) / 10)
      : String(Math.round(kgToLb(kg) * 10) / 10);
  });
  const [pace, setPace] = useState<Pace | null>(answers.pace ?? suggested);
  const [touched, setTouched] = useState(false);

  const targetKg = useMemo(() => {
    const trimmed = targetDisplay.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return units === 'metric' ? n : lbToKg(n);
  }, [targetDisplay, units]);

  const weekly = answers.goalType && pace ? weeklyChangeForPace(answers.goalType, pace) : 0;
  const weeks =
    targetKg != null && weekly !== 0 ? estimatedWeeksToGoal(currentKg, targetKg, weekly) : null;

  const compatible =
    targetKg == null ||
    answers.goalType == null ||
    isTargetCompatibleWithGoal(answers.goalType, currentKg, targetKg);
  const safe = targetKg == null || isTargetWithinSafeRange(currentKg, targetKg);

  // Hard requirements only — direction mismatch is a warning, not a blocker.
  const canContinue =
    targetKg != null &&
    pace != null &&
    targetKg >= 40 &&
    targetKg <= 250;

  const goalHint =
    answers.goalType === 'lose_weight'
      ? t('setup.target.hintLower')
      : answers.goalType === 'gain_weight'
        ? t('setup.target.hintHigher')
        : t('setup.target.hintClose');

  const directionWarning =
    targetKg != null && answers.goalType != null && !compatible
      ? answers.goalType === 'lose_weight'
        ? t('setup.target.warnCut', {
            target: formatWeight(targetKg, units),
            current: formatWeight(currentKg, units),
          })
        : answers.goalType === 'gain_weight'
          ? t('setup.target.warnBulk', {
              target: formatWeight(targetKg, units),
              current: formatWeight(currentKg, units),
            })
          : t('setup.target.warnMaintain', { hint: goalHint })
      : null;

  const rangeWarning =
    targetKg != null && !safe && compatible ? t('setup.target.warnRange') : null;

  const suggestedPaceLabel =
    suggested === 'slow'
      ? t('setup.target.paceSlow')
      : suggested === 'moderate'
        ? t('setup.target.paceModerate')
        : suggested === 'fast'
          ? t('setup.target.paceFast')
          : null;

  return (
    <SetupShell
      title={t('setup.target.title')}
      subtitle={t('setup.target.subtitle', { weight: formatWeight(currentKg, units) })}
      stepIndex={progress.index}
      stepTotal={progress.total}
      onBack={() => void goBack()}
      continueDisabled={saving}
      continueLoading={saving}
      onContinue={() => {
        setTouched(true);
        if (!canContinue || targetKg == null || !pace) return;
        void goNext({ targetWeightKg: targetKg, pace });
      }}
    >
      <View className="gap-4">
        <Input
          label={units === 'metric' ? t('setup.target.weightKg') : t('setup.target.weightLb')}
          value={targetDisplay}
          onChangeText={setTargetDisplay}
          keyboardType="decimal-pad"
          placeholder={
            units === 'metric' ? t('setup.target.placeholderKg') : t('setup.target.placeholderLb')
          }
          error={
            touched && targetDisplay.trim() === ''
              ? t('setup.target.emptyError')
              : touched && targetKg != null && (targetKg < 40 || targetKg > 250)
                ? t('setup.target.rangeError')
                : undefined
          }
        />

        {directionWarning ? (
          <View
            style={{
              borderRadius: radii.md,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2] + 2,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text variant="bodySmall" style={{ color: colors.warningStrong }}>
              {directionWarning}
            </Text>
          </View>
        ) : null}

        {rangeWarning ? (
          <View
            style={{
              borderRadius: radii.md,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2] + 2,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text variant="bodySmall" style={{ color: colors.warningStrong }}>
              {rangeWarning}
            </Text>
          </View>
        ) : null}

        <Text variant="label" tone="secondary">
          {suggestedPaceLabel
            ? t('setup.target.paceSuggested', { pace: suggestedPaceLabel })
            : t('setup.target.paceLabel')}
        </Text>
        {PACES.map((option) => (
          <SelectionCard
            key={option.value}
            label={t(
              option.value === 'slow'
                ? 'setup.target.paceSlow'
                : option.value === 'moderate'
                  ? 'setup.target.paceModerate'
                  : 'setup.target.paceFast',
            )}
            description={t('setup.target.paceAbout', {
              kg: option.kg,
              lb: (option.kg * 2.2).toFixed(1),
            })}
            selected={pace === option.value}
            onPress={() => setPace(option.value)}
          />
        ))}

        {weeks != null && compatible ? (
          <View
            style={{
              borderRadius: radii.md,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2] + 2,
              backgroundColor: colors.primaryMuted,
            }}
          >
            <Text variant="bodySmall" tone="muted">
              {t('setup.target.timeline', { weeks })}
              {t('setup.target.timelineHint')}
            </Text>
          </View>
        ) : null}

        {touched && !canContinue ? (
          <Text variant="caption" tone="error">
            {t('setup.target.continueError')}
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
