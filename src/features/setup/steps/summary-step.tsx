import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { estimatePlan } from '@/features/setup/calculations';
import { useSetup } from '@/features/setup/setup-provider';
import { SetupShell } from '@/features/setup/setup-shell';
import { setupCardShadow } from '@/features/setup/setup-shadows';
import { requiresManualCalories } from '@/features/setup/types';
import { formatHeight, formatWeight } from '@/features/setup/units';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

function StatTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="headingSmall" style={{ color: colors.textPrimary }}>
        {value}
        {unit ? (
          <Text variant="caption" tone="muted">
            {' '}
            {unit}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

/**
 * Final review — system estimates are read-only.
 * No recalculate / edit-earlier (use Back). Daily calories & macros locked.
 */
export function SummaryStep() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { answers, progress, goBack, finish, completing, error } = useSetup();
  const [busy, setBusy] = useState(false);

  const plan = useMemo(() => {
    if (
      !answers.goalType ||
      !answers.sex ||
      answers.ageYears == null ||
      answers.heightCm == null ||
      answers.weightKg == null ||
      !answers.activityLevel
    ) {
      return null;
    }
    const sessions = answers.sessionsPerWeek ?? 0;
    return estimatePlan({
      goalType: answers.goalType,
      sex: answers.sex,
      ageYears: answers.ageYears,
      heightCm: answers.heightCm,
      weightKg: answers.weightKg,
      bodyFatPercent: answers.bodyFatPercent,
      activityLevel: answers.activityLevel,
      averageDailySteps: answers.averageDailySteps,
      sessionsPerWeek: sessions,
      exerciseType: sessions === 0 ? 'none' : (answers.exerciseType ?? 'mixed'),
      sessionMinutes: answers.sessionMinutes ?? 0,
      intensity: answers.intensity ?? 'moderate',
      targetWeightKg:
        answers.goalType === 'maintain_weight'
          ? answers.weightKg
          : (answers.targetWeightKg ?? answers.weightKg),
      pace: answers.goalType === 'maintain_weight' ? null : answers.pace,
      requiresManualCalories: requiresManualCalories(answers),
      manualDailyCalories: answers.manualDailyCalories,
    });
  }, [answers]);

  const calories = plan?.dailyCalorieTarget ?? 0;
  const protein = plan?.macros.protein_g ?? 0;
  const carbs = plan?.macros.carbs_g ?? 0;
  const fat = plan?.macros.fat_g ?? 0;

  const goalLabel =
    answers.goalType === 'lose_weight'
      ? t('setup.summary.goalLose')
      : answers.goalType === 'gain_weight'
        ? t('setup.summary.goalGain')
        : t('setup.summary.goalMaintain');

  const exerciseTypeKey =
    answers.exerciseType === 'strength'
      ? 'setup.summary.typeStrength'
      : answers.exerciseType === 'cardio'
        ? 'setup.summary.typeCardio'
        : answers.exerciseType === 'sports'
          ? 'setup.summary.typeSports'
          : answers.exerciseType === 'mixed'
            ? 'setup.summary.typeMixed'
            : answers.exerciseType === 'other'
              ? 'setup.summary.typeOther'
              : null;

  const exerciseLabel =
    answers.sessionsPerWeek === 0 || answers.exerciseType === 'none'
      ? t('setup.summary.exerciseNone')
      : answers.exerciseType === 'other' && answers.exerciseTypeOther
        ? answers.exerciseTypeOther
        : exerciseTypeKey
          ? t(exerciseTypeKey)
          : '—';

  const explanation =
    plan == null
      ? null
      : !plan.canAutoEstimate
        ? plan.usedManualCalories && calories >= 1200
          ? t('setup.summary.explanationManual')
          : t('setup.summary.explanationNeedManual')
        : t('setup.summary.explanationAuto');

  return (
    <SetupShell
      title={t('setup.summary.title')}
      subtitle={t('setup.summary.subtitle')}
      stepIndex={progress.index}
      stepTotal={progress.total}
      onBack={() => void goBack()}
      continueLabel={t('setup.summary.start')}
      continueDisabled={completing || busy || !plan || calories < 1200}
      continueLoading={completing || busy}
      onContinue={() => {
        setBusy(true);
        void finish()
          .catch(() => undefined)
          .finally(() => setBusy(false));
      }}
    >
      <View style={styles.stack}>
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surfaceMuted },
            setupCardShadow('#000000'),
          ]}
        >
          <Text variant="label" tone="muted">
            {t('setup.summary.profileGoal')}
          </Text>
          <Text variant="bodyStrong" style={{ color: colors.textPrimary }}>
            {goalLabel}
            {answers.ageYears != null ? ` · ${t('setup.summary.age', { years: answers.ageYears })}` : ''}
          </Text>
          <Text variant="bodySmall" tone="muted">
            {answers.heightCm != null ? formatHeight(answers.heightCm, answers.units) : '—'}
            {' · '}
            {answers.weightKg != null ? formatWeight(answers.weightKg, answers.units) : '—'}
            {answers.targetWeightKg != null && answers.goalType !== 'maintain_weight'
              ? ` → ${formatWeight(answers.targetWeightKg, answers.units)}`
              : ''}
          </Text>
          <Text variant="bodySmall" tone="muted">
            {t('setup.summary.exercise', { label: exerciseLabel })}
            {answers.sessionsPerWeek != null && answers.sessionsPerWeek > 0
              ? ` · ${t('setup.summary.perWeek', { count: answers.sessionsPerWeek })}`
              : ''}
          </Text>
        </View>

        {plan?.tdee != null ? (
          <Text variant="bodySmall" tone="muted">
            {t('setup.summary.maintenance', { tdee: plan.tdee })}
            {plan.bmr != null ? t('setup.summary.bmr', { bmr: plan.bmr }) : ''}
          </Text>
        ) : null}

        <View style={styles.statsGrid}>
          <View style={styles.statWide}>
            <StatTile label={t('setup.summary.dailyCalories')} value={calories} unit="kcal" />
          </View>
          <StatTile label={t('setup.summary.protein')} value={protein} unit="g" />
          <StatTile label={t('setup.summary.carbs')} value={carbs} unit="g" />
          <StatTile label={t('setup.summary.fat')} value={fat} unit="g" />
        </View>

        {plan && plan.weeklyChangeKg !== 0 ? (
          <Text variant="bodySmall" tone="muted">
            {t('setup.summary.weeklyChange', {
              sign: plan.weeklyChangeKg > 0 ? '+' : '',
              kg: plan.weeklyChangeKg,
            })}
            {plan.estimatedWeeks != null
              ? t('setup.summary.weeksEstimate', { weeks: plan.estimatedWeeks })
              : ''}
          </Text>
        ) : null}

        {explanation ? (
          <Text variant="caption" tone="muted">
            {explanation}
          </Text>
        ) : null}

        <Text variant="caption" tone="muted">
          {t('setup.summary.lockedNote')}
        </Text>

        {error ? (
          <View
            style={[styles.errorBox, { backgroundColor: colors.errorMuted }]}
          >
            <Text variant="bodySmall" tone="error">
              {error}
            </Text>
          </View>
        ) : null}
      </View>
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  section: {
    borderRadius: radii.md,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statWide: {
    width: '100%',
  },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    borderRadius: radii.md,
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  errorBox: {
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
