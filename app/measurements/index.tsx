import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useProfile } from '@/features/goals/hooks';
import { MeasurementHistoryItem } from '@/features/measurements/components/measurement-history-item';
import { NavyCompositionPreview } from '@/features/measurements/components/navy-composition-preview';
import {
  calculateBmi,
  type BodyMeasurement,
  useAddBodyMeasurement,
  useBodyMeasurements,
  useDeleteBodyMeasurement,
  useUpdateBodyMeasurement,
} from '@/features/measurements/hooks';
import { deriveBodyComposition } from '@/features/measurements/navy-body-fat';
import { cmToIn, inToCm, kgToLb, lbToKg, type UnitSystem } from '@/features/setup/units';
import { spacing } from '@/theme';
import { toDiaryDateKey } from '@/utils/date';

type FormState = {
  weight: string;
  neck: string;
  waist: string;
  hip: string;
  bicep: string;
  thigh: string;
  bodyFat: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  weight: '',
  neck: '',
  waist: '',
  hip: '',
  bicep: '',
  thigh: '',
  bodyFat: '',
  notes: '',
};

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function displayWeight(kg: number | null | undefined, units: UnitSystem): string {
  if (kg == null) return '';
  if (units === 'imperial') return String(Math.round(kgToLb(kg) * 10) / 10);
  return String(Math.round(kg * 10) / 10);
}

function displayLength(cm: number | null | undefined, units: UnitSystem): string {
  if (cm == null) return '';
  if (units === 'imperial') return String(Math.round(cmToIn(cm) * 10) / 10);
  return String(Math.round(cm * 10) / 10);
}

function formFromRow(row: BodyMeasurement, units: UnitSystem): FormState {
  return {
    weight: displayWeight(row.weight_kg, units),
    neck: displayLength(row.neck_cm, units),
    waist: displayLength(row.waist_cm, units),
    hip: displayLength(row.hip_cm, units),
    bicep: displayLength(row.bicep_cm, units),
    thigh: displayLength(row.thigh_cm, units),
    bodyFat:
      row.composition_method === 'manual' && row.body_fat_percent != null
        ? String(Math.round(Number(row.body_fat_percent) * 10) / 10)
        : '',
    notes: row.notes ?? '',
  };
}

function prefillFromLatest(latest: BodyMeasurement | undefined, units: UnitSystem): FormState {
  if (!latest) return EMPTY_FORM;
  return {
    weight: displayWeight(latest.weight_kg, units),
    neck: displayLength(latest.neck_cm, units),
    waist: displayLength(latest.waist_cm, units),
    hip: displayLength(latest.hip_cm, units),
    bicep: displayLength(latest.bicep_cm, units),
    thigh: displayLength(latest.thigh_cm, units),
    bodyFat: '',
    notes: '',
  };
}

function toMetricWeight(raw: string, units: UnitSystem): number | undefined {
  const n = parseOptionalNumber(raw);
  if (n == null) return undefined;
  return units === 'imperial' ? lbToKg(n) : n;
}

function toMetricLength(raw: string, units: UnitSystem): number | undefined {
  const n = parseOptionalNumber(raw);
  if (n == null) return undefined;
  return units === 'imperial' ? inToCm(n) : n;
}

export default function MeasurementsScreen() {
  const { t } = useTranslation();
  const profile = useProfile();
  const history = useBodyMeasurements();
  const add = useAddBodyMeasurement();
  const update = useUpdateBodyMeasurement();
  const remove = useDeleteBodyMeasurement();

  const units: UnitSystem = profile.data?.units === 'imperial' ? 'imperial' : 'metric';
  const weightUnit = units === 'imperial' ? t('measurements.unitLb') : t('measurements.unitKg');
  const lengthUnit = units === 'imperial' ? t('measurements.unitIn') : t('measurements.unitCm');

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [prefilled, setPrefilled] = useState(false);
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BodyMeasurement | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!prefilled && !editing && !history.isLoading) {
    const latest = history.data?.[0];
    setPrefilled(true);
    if (latest) setForm(prefillFromLatest(latest, units));
  }

  const weightKg = toMetricWeight(form.weight, units) ?? null;
  const neckCm = toMetricLength(form.neck, units) ?? null;
  const waistCm = toMetricLength(form.waist, units) ?? null;
  const hipCm = toMetricLength(form.hip, units) ?? null;

  const composition = useMemo(
    () =>
      deriveBodyComposition({
        sex: profile.data?.sex,
        heightCm: profile.data?.height_cm,
        weightKg,
        neckCm,
        waistCm,
        hipCm,
      }),
    [hipCm, neckCm, profile.data?.height_cm, profile.data?.sex, waistCm, weightKg],
  );

  const bmi =
    weightKg != null && profile.data?.height_cm
      ? calculateBmi(weightKg, Number(profile.data.height_cm))
      : null;

  const saving = add.isPending || update.isPending;

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setEditing(null);
    setError(null);
    const latest = history.data?.[0];
    setForm(prefillFromLatest(latest, units));
  }

  function startEdit(row: BodyMeasurement) {
    setEditing(row);
    setError(null);
    setForm(formFromRow(row, units));
  }

  async function onSave() {
    setError(null);
    const measuredOn = editing?.measured_on ?? toDiaryDateKey();
    const manualBf = parseOptionalNumber(form.bodyFat);
    const payload = {
      measuredOn,
      weightKg: toMetricWeight(form.weight, units) ?? null,
      neckCm: toMetricLength(form.neck, units) ?? null,
      waistCm: toMetricLength(form.waist, units) ?? null,
      hipCm: toMetricLength(form.hip, units) ?? null,
      bicepCm: toMetricLength(form.bicep, units) ?? null,
      thighCm: toMetricLength(form.thigh, units) ?? null,
      // Only send manual BF when the user entered a value, or when clearing a prior manual entry.
      ...(manualBf !== undefined || editing?.composition_method === 'manual'
        ? { bodyFatPercent: manualBf ?? null }
        : {}),
      notes: form.notes.trim() ? form.notes.trim() : null,
    };

    const hasAnyValue = [
      payload.weightKg,
      payload.neckCm,
      payload.waistCm,
      payload.hipCm,
      payload.bicepCm,
      payload.thighCm,
      'bodyFatPercent' in payload ? payload.bodyFatPercent : undefined,
      payload.notes,
    ].some((value) => value != null);

    if (!hasAnyValue) {
      setError(t('measurements.errorEmpty'));
      return;
    }

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
      } else {
        await add.mutateAsync(payload);
      }
      setEditing(null);
      setForm(EMPTY_FORM);
      setPrefilled(false);
      await history.refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('measurements.errorSave'));
    }
  }

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-4">
        <View className="flex-row items-start gap-2">
          <ChromeIconButton
            header
            label={t('measurements.close')}
            onPress={() => router.back()}
            icon={(color) => <X size={22} color={color} />}
          />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('measurements.title')}
          </Text>
        </View>

        <Text variant="bodySmall" tone="secondary">
          {t('measurements.subtitle')}
        </Text>

        {editing ? (
          <Text variant="bodySmall" tone="brand">
            {t('measurements.editingOn', { date: editing.measured_on })}
          </Text>
        ) : null}

        <View className="gap-3">
          <Text variant="headingSmall">{t('measurements.groupBasic')}</Text>
          <Input
            label={t('measurements.weight', { unit: weightUnit })}
            value={form.weight}
            onChangeText={(value) => setField('weight', value)}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('measurements.neck', { unit: lengthUnit })}
            value={form.neck}
            onChangeText={(value) => setField('neck', value)}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('measurements.waist', { unit: lengthUnit })}
            value={form.waist}
            onChangeText={(value) => setField('waist', value)}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('measurements.hip', { unit: lengthUnit })}
            value={form.hip}
            onChangeText={(value) => setField('hip', value)}
            keyboardType="decimal-pad"
          />
        </View>

        <View className="gap-3">
          <Text variant="headingSmall">{t('measurements.groupAdditional')}</Text>
          <Input
            label={t('measurements.bicep', { unit: lengthUnit })}
            value={form.bicep}
            onChangeText={(value) => setField('bicep', value)}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('measurements.thigh', { unit: lengthUnit })}
            value={form.thigh}
            onChangeText={(value) => setField('thigh', value)}
            keyboardType="decimal-pad"
          />
        </View>

        <NavyCompositionPreview composition={composition} units={units} bmi={bmi} />

        <View className="gap-3">
          <Text variant="headingSmall">{t('measurements.manualSection')}</Text>
          <Text variant="bodySmall" tone="secondary">
            {t('measurements.manualHint')}
          </Text>
          <Input
            label={t('measurements.bodyFatManual')}
            value={form.bodyFat}
            onChangeText={(value) => setField('bodyFat', value)}
            keyboardType="decimal-pad"
          />
          <Input
            label={t('measurements.notes')}
            value={form.notes}
            onChangeText={(value) => setField('notes', value)}
          />
        </View>

        {error ? (
          <Text variant="bodySmall" tone="error">
            {error}
          </Text>
        ) : null}

        <View className="gap-2">
          <Button
            label={editing ? t('measurements.saveChanges') : t('measurements.save')}
            loading={saving}
            disabled={saving}
            onPress={() => {
              void onSave();
            }}
          />
          {editing ? (
            <Button
              label={t('measurements.cancelEdit')}
              variant="secondary"
              disabled={saving}
              onPress={resetForm}
            />
          ) : null}
        </View>

        <View className="gap-3" style={{ marginTop: spacing[2] }}>
          <Text variant="headingSmall">{t('measurements.history')}</Text>
          {history.isLoading ? <LoadingState /> : null}
          {history.error ? (
            <ErrorState
              title={t('measurements.historyLoadError')}
              body={
                history.error instanceof Error
                  ? history.error.message
                  : t('measurements.historyLoadErrorBody')
              }
              onRetry={() => void history.refetch()}
            />
          ) : null}
          {!history.isLoading && !history.error && (history.data?.length ?? 0) === 0 ? (
            <EmptyState
              title={t('measurements.historyEmptyTitle')}
              body={t('measurements.historyEmptyBody')}
            />
          ) : null}
          {(history.data ?? []).map((row) => (
            <MeasurementHistoryItem
              key={row.id}
              row={row}
              units={units}
              onEdit={startEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </View>
      </View>

      <DeleteConfirmDialog
        visible={deleteTarget != null}
        title={t('measurements.deleteTitle')}
        body={t('measurements.deleteBody')}
        cancelLabel={t('measurements.cancel')}
        confirmLabel={t('measurements.delete')}
        loading={remove.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void remove
            .mutateAsync(deleteTarget.id)
            .then(() => {
              if (editing?.id === deleteTarget.id) {
                resetForm();
              }
              setDeleteTarget(null);
            })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : t('measurements.errorDelete'));
              setDeleteTarget(null);
            });
        }}
      />
    </Screen>
  );
}
