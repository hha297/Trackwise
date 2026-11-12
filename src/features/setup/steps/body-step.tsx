import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { SexForEstimate } from '@/features/setup/calculations';
import { SelectionCard } from '@/features/setup/selection-card';
import { useSetup } from '@/features/setup/setup-provider';
import { SetupShell } from '@/features/setup/setup-shell';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg, type UnitSystem } from '@/features/setup/units';

export function BodyStep() {
  const { t } = useTranslation();
  const { answers, progress, goNext, goBack, saving, error } = useSetup();
  const [units, setUnits] = useState<UnitSystem>(answers.units);
  const [age, setAge] = useState(answers.ageYears != null ? String(answers.ageYears) : '');
  const [sex, setSex] = useState<SexForEstimate | null>(answers.sex);
  const [heightCm, setHeightCm] = useState(answers.heightCm);
  const [weightKg, setWeightKg] = useState(answers.weightKg);
  const [bodyFat, setBodyFat] = useState(
    answers.bodyFatPercent != null ? String(answers.bodyFatPercent) : '',
  );
  const [manualCalories, setManualCalories] = useState(
    answers.manualDailyCalories != null ? String(answers.manualDailyCalories) : '',
  );
  const [touched, setTouched] = useState(false);

  const heightDisplay = useMemo(() => {
    if (heightCm == null) return { metric: '', feet: '', inches: '' };
    if (units === 'metric') {
      return { metric: String(Math.round(heightCm * 10) / 10), feet: '', inches: '' };
    }
    const { feet, inches } = cmToFtIn(heightCm);
    return { metric: '', feet: String(feet), inches: String(inches) };
  }, [heightCm, units]);

  const [heightMetric, setHeightMetric] = useState(heightDisplay.metric);
  const [heightFt, setHeightFt] = useState(heightDisplay.feet);
  const [heightIn, setHeightIn] = useState(heightDisplay.inches);
  const [weightDisplay, setWeightDisplay] = useState(
    weightKg == null ? '' : units === 'metric' ? String(weightKg) : String(Math.round(kgToLb(weightKg) * 10) / 10),
  );

  const ageNum = Number(age);
  const bfNum = bodyFat.trim() === '' ? null : Number(bodyFat);
  const manualNum = manualCalories.trim() === '' ? null : Number(manualCalories);

  const needsManual =
    answers.isPregnantOrBreastfeeding === true ||
    sex === 'prefer_not_to_say' ||
    sex === 'other' ||
    (Number.isFinite(ageNum) && ageNum < 18);

  function syncHeightFromInputs(nextUnits: UnitSystem, metric: string, ft: string, inches: string) {
    if (nextUnits === 'metric') {
      const cm = Number(metric);
      if (Number.isFinite(cm)) setHeightCm(cm);
      return;
    }
    const feet = Number(ft);
    const inch = Number(inches);
    if (Number.isFinite(feet) && Number.isFinite(inch)) {
      setHeightCm(ftInToCm(feet, inch));
    }
  }

  function switchUnits(next: UnitSystem) {
    if (next === units) return;
    // Canonical kg/cm already stored — only refresh displays.
    if (heightCm != null) {
      if (next === 'metric') {
        setHeightMetric(String(Math.round(heightCm * 10) / 10));
      } else {
        const { feet, inches } = cmToFtIn(heightCm);
        setHeightFt(String(feet));
        setHeightIn(String(inches));
      }
    }
    if (weightKg != null) {
      setWeightDisplay(
        next === 'metric'
          ? String(Math.round(weightKg * 10) / 10)
          : String(Math.round(kgToLb(weightKg) * 10) / 10),
      );
    }
    setUnits(next);
  }

  const resolvedHeight = heightCm;
  const resolvedWeight = weightKg;
  const valid =
    Number.isFinite(ageNum) &&
    ageNum >= 13 &&
    ageNum <= 100 &&
    sex != null &&
    resolvedHeight != null &&
    resolvedHeight >= 120 &&
    resolvedHeight <= 230 &&
    resolvedWeight != null &&
    resolvedWeight >= 35 &&
    resolvedWeight <= 250 &&
    (bfNum == null || (bfNum >= 3 && bfNum <= 60)) &&
    (!needsManual || (manualNum != null && manualNum >= 1200));

  const sexOptions = [
    { value: 'female' as const, label: t('setup.body.female') },
    { value: 'male' as const, label: t('setup.body.male') },
    { value: 'prefer_not_to_say' as const, label: t('setup.body.preferNotToSay') },
  ];

  return (
    <SetupShell
      title={t('setup.body.title')}
      subtitle={t('setup.body.subtitle')}
      stepIndex={progress.index}
      stepTotal={progress.total}
      onBack={() => void goBack()}
      continueDisabled={saving}
      continueLoading={saving}
      onContinue={() => {
        setTouched(true);
        if (!valid || !sex || resolvedHeight == null || resolvedWeight == null) return;
        void goNext({
          units,
          ageYears: ageNum,
          sex,
          heightCm: resolvedHeight,
          weightKg: resolvedWeight,
          bodyFatPercent: bfNum,
          manualDailyCalories: needsManual ? manualNum : answers.manualDailyCalories,
          targetWeightKg:
            answers.goalType === 'maintain_weight' ? resolvedWeight : answers.targetWeightKg,
        });
      }}
    >
      <View className="gap-4">
        <View className="gap-2">
          <Text variant="label" tone="secondary">
            {t('setup.body.units')}
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <SelectionCard
                label={t('setup.body.metric')}
                selected={units === 'metric'}
                onPress={() => switchUnits('metric')}
              />
            </View>
            <View className="flex-1">
              <SelectionCard
                label={t('setup.body.imperial')}
                selected={units === 'imperial'}
                onPress={() => switchUnits('imperial')}
              />
            </View>
          </View>
        </View>

        <Input
          label={t('setup.body.age')}
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          placeholder={t('setup.body.agePlaceholder')}
          error={
            touched && !(ageNum >= 13 && ageNum <= 100) ? t('setup.body.ageError') : undefined
          }
        />

        <View className="gap-2">
          <Text variant="label" tone="secondary">
            {t('setup.body.sexLabel')}
          </Text>
          <Text variant="caption" tone="muted">
            {t('setup.body.sexHint')}
          </Text>
          {sexOptions.map((option) => (
            <SelectionCard
              key={option.value}
              label={option.label}
              selected={sex === option.value}
              onPress={() => setSex(option.value)}
            />
          ))}
        </View>

        {units === 'metric' ? (
          <Input
            label={t('setup.body.heightCm')}
            value={heightMetric}
            onChangeText={(text) => {
              setHeightMetric(text);
              syncHeightFromInputs('metric', text, heightFt, heightIn);
            }}
            keyboardType="decimal-pad"
            placeholder={t('setup.body.heightCmPlaceholder')}
          />
        ) : (
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label={t('setup.body.heightFt')}
                value={heightFt}
                onChangeText={(text) => {
                  setHeightFt(text);
                  syncHeightFromInputs('imperial', heightMetric, text, heightIn);
                }}
                keyboardType="number-pad"
                placeholder={t('setup.body.heightFtPlaceholder')}
              />
            </View>
            <View className="flex-1">
              <Input
                label={t('setup.body.heightIn')}
                value={heightIn}
                onChangeText={(text) => {
                  setHeightIn(text);
                  syncHeightFromInputs('imperial', heightMetric, heightFt, text);
                }}
                keyboardType="decimal-pad"
                placeholder={t('setup.body.heightInPlaceholder')}
              />
            </View>
          </View>
        )}

        <Input
          label={units === 'metric' ? t('setup.body.weightKg') : t('setup.body.weightLb')}
          value={weightDisplay}
          onChangeText={(text) => {
            setWeightDisplay(text);
            const n = Number(text);
            if (!Number.isFinite(n)) return;
            setWeightKg(units === 'metric' ? n : lbToKg(n));
          }}
          keyboardType="decimal-pad"
          placeholder={
            units === 'metric'
              ? t('setup.body.weightKgPlaceholder')
              : t('setup.body.weightLbPlaceholder')
          }
        />

        <Input
          label={t('setup.body.bodyFat')}
          value={bodyFat}
          onChangeText={setBodyFat}
          keyboardType="decimal-pad"
          placeholder={t('setup.body.bodyFatPlaceholder')}
        />

        {needsManual ? (
          <View className="gap-1.5">
            <Text variant="bodySmall" tone="secondary">
              {t('setup.body.manualHint')}
            </Text>
            <Input
              label={t('setup.body.calorieLabel')}
              value={manualCalories}
              onChangeText={setManualCalories}
              keyboardType="number-pad"
              placeholder={t('setup.body.caloriePlaceholder')}
              error={
                touched && needsManual && !(manualNum != null && manualNum >= 1200)
                  ? t('setup.body.calorieError')
                  : undefined
              }
            />
          </View>
        ) : null}

        {touched && !valid ? (
          <Text variant="caption" tone="error">
            {t('setup.body.fieldsError')}
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
