import { Beef, Droplets, Info, Wheat, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Text } from '@/components/ui/text';
import { MacroHorizontalSlider } from '@/features/diary/components/macro-horizontal-slider';
import {
  assertMacroTotal,
  DIET_PRESET_ORDER,
  DIET_PRESET_PERCENTS,
  gramsFromPercents,
  macroBalanceWarning,
  proteinDensityWarning,
  resolveFiberTarget,
  type DietPresetId,
  type MacroPercents,
} from '@/features/diary/diet-presets';
import { useUpdateActiveGoalDiet } from '@/features/goals/hooks';
import type { Goal, Profile } from '@/features/goals/types';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type DietSelectorModalProps = {
  visible: boolean;
  onClose: () => void;
  goal: Goal | null | undefined;
  profile: Profile | null | undefined;
  weightKg: number | null;
  initialPercents: MacroPercents;
  initialPreset: DietPresetId;
};

export function DietSelectorModal({
  visible,
  onClose,
  goal,
  profile,
  weightKg,
  initialPercents,
  initialPreset,
}: DietSelectorModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const saveDiet = useUpdateActiveGoalDiet();
  const calorieTarget = goal?.daily_calorie_target ?? 2000;

  const [percents, setPercents] = useState(initialPercents);
  const [preset, setPreset] = useState(initialPreset);
  const [infoId, setInfoId] = useState<DietPresetId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sliderDragging, setSliderDragging] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);

  if (visible && !sessionOpen) {
    setSessionOpen(true);
    setPercents(initialPercents);
    setPreset(initialPreset);
    setError(null);
    setInfoId(null);
  } else if (!visible && sessionOpen) {
    setSessionOpen(false);
  }

  const editable = preset === 'custom';
  const total = percents.carbs + percents.protein + percents.fat;
  const valid = assertMacroTotal(percents);
  const totalTone = total === 100 ? 'brand' : total > 100 ? 'error' : 'secondary';

  const grams = useMemo(
    () => gramsFromPercents(calorieTarget, percents),
    [calorieTarget, percents],
  );
  const fiberTarget = resolveFiberTarget({
    storedFiberG: goal?.fiber_g,
    calorieTarget,
    sex: profile?.sex,
  });
  const proteinWarn = proteinDensityWarning(grams.proteinG, weightKg);
  const balanceWarn = macroBalanceWarning(percents, preset);

  const applyPreset = (id: DietPresetId) => {
    if (id === 'custom') {
      setPreset('custom');
      setInfoId(null);
      return;
    }
    setPercents({ ...DIET_PRESET_PERCENTS[id] });
    setPreset(id);
    setError(null);
    if (infoId != null && infoId !== id) setInfoId(null);
  };

  const showPresetInfo = (id: DietPresetId) => {
    applyPreset(id);
    setInfoId((prev) => (prev === id ? null : id));
  };

  /** Independent edit — no silent redistribution; switches to Custom. */
  const changeMacro = (key: keyof MacroPercents, value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    setPercents((prev) => ({ ...prev, [key]: clamped }));
    setPreset('custom');
    setInfoId(null);
  };

  const onSave = async () => {
    if (!assertMacroTotal(percents)) {
      setError(t('diary.diet.invalidTotal'));
      return;
    }
    try {
      await saveDiet.mutateAsync({
        dietPreset: preset,
        carbsPct: percents.carbs,
        proteinPct: percents.protein,
        fatPct: percents.fat,
        carbsG: grams.carbsG,
        proteinG: grams.proteinG,
        fatG: grams.fatG,
        fiberG: fiberTarget,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('diary.diet.saveFailed'));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          accessibilityRole="button"
          accessibilityLabel={t('diary.diet.close')}
          onPress={onClose}
        />
        <SafeAreaView
          edges={['top', 'bottom']}
          style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View className="flex-row items-start gap-2 px-4 pb-2 pt-3">
            <ChromeIconButton
              header
              label={t('diary.diet.close')}
              onPress={onClose}
              icon={(color) => <X size={22} color={color} />}
            />
            <Text variant="headingMedium" className="min-w-0 flex-1" numberOfLines={1}>
              {t('diary.diet.title')}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing[4],
              paddingTop: spacing[2],
              paddingBottom: spacing[8],
              gap: spacing[4],
            }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            directionalLockEnabled
            scrollEnabled={!sliderDragging}
          >
            <Text variant="bodySmall" tone="secondary">
              {t('diary.diet.subtitle')}
            </Text>

            <View className="gap-2">
              <Text variant="label" tone="secondary">
                {t('diary.diet.presets')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {DIET_PRESET_ORDER.map((id) => {
                  const selected = preset === id;
                  return (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => applyPreset(id)}
                      className="flex-row items-center gap-1 px-3 py-2"
                      style={{
                        borderRadius: radii.pill,
                        backgroundColor: selected ? colors.primaryMuted : colors.surfaceMuted,
                        borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
                        borderColor: selected ? colors.primary : colors.border,
                      }}
                    >
                      <Text variant="caption" tone={selected ? 'brand' : 'secondary'}>
                        {t(`diary.diet.preset.${id}`)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('diary.diet.info')}
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          showPresetInfo(id);
                        }}
                      >
                        <Info
                          size={14}
                          color={selected ? colors.primary : colors.textMuted}
                        />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
              {infoId ? (
                <View
                  className="gap-1 px-3 py-3"
                  style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md }}
                >
                  <Text variant="bodyStrong">{t(`diary.diet.preset.${infoId}`)}</Text>
                  <Text variant="caption" tone="secondary">
                    {t(`diary.diet.infoText.${infoId}`)}
                  </Text>
                </View>
              ) : null}
              <Text variant="caption" tone="secondary">
                {editable
                  ? t('diary.diet.customEditHint')
                  : t('diary.diet.editSwitchesToCustom')}
              </Text>
            </View>

            <View className="gap-3">
              <Text variant="label" tone="secondary">
                {t('diary.diet.distributionHeading')}
              </Text>
              <MacroHorizontalSlider
                label={t('diary.macros.carbs')}
                value={percents.carbs}
                color={colors.macroCarbs}
                icon={<Wheat size={18} color={colors.macroCarbs} />}
                onChange={(v) => changeMacro('carbs', v)}
                onDraggingChange={setSliderDragging}
              />
              <MacroHorizontalSlider
                label={t('diary.macros.protein')}
                value={percents.protein}
                color={colors.macroProtein}
                icon={<Beef size={18} color={colors.macroProtein} />}
                onChange={(v) => changeMacro('protein', v)}
                onDraggingChange={setSliderDragging}
              />
              <MacroHorizontalSlider
                label={t('diary.macros.fat')}
                value={percents.fat}
                color={colors.macroFat}
                icon={<Droplets size={18} color={colors.macroFat} />}
                onChange={(v) => changeMacro('fat', v)}
                onDraggingChange={setSliderDragging}
              />
            </View>

            <View
              className="gap-2 rounded-xl px-3 py-3"
              style={{ backgroundColor: colors.surfaceMuted }}
            >
              <View className="flex-row items-center justify-between">
                <Text variant="bodyStrong">{t('diary.diet.totalDistribution')}</Text>
                <Text variant="headingSmall" tone={totalTone}>
                  {total}%
                </Text>
              </View>
              <Text variant="caption" tone="secondary">
                {total > 100
                  ? t('diary.diet.totalOver')
                  : total < 100
                    ? t('diary.diet.totalUnder')
                    : t('diary.diet.totalOk')}
              </Text>
              <Text variant="caption" tone="secondary">
                {t('diary.diet.saveRequirement')}
              </Text>
              <Text variant="caption" tone="muted">
                {t('diary.diet.gramPreview', {
                  calories: calorieTarget,
                  carbs: grams.carbsG,
                  protein: grams.proteinG,
                  fat: grams.fatG,
                })}
              </Text>
            </View>

            {balanceWarn ? (
              <View
                className="gap-1 px-3 py-3"
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.warning,
                }}
              >
                <Text variant="bodyStrong">{t('diary.diet.balanceWarnTitle')}</Text>
                <Text variant="caption" tone="secondary">
                  {t(`diary.diet.balanceWarn.${balanceWarn}`)}
                </Text>
              </View>
            ) : null}

            {proteinWarn ? (
              <Text variant="caption" tone="secondary">
                {t(
                  proteinWarn === 'low'
                    ? 'diary.diet.proteinWarnLow'
                    : 'diary.diet.proteinWarnHigh',
                )}
              </Text>
            ) : null}

            {error ? (
              <Text variant="caption" tone="error">
                {error}
              </Text>
            ) : null}

            <View className="gap-2">
              <Button
                label={t('diary.diet.save')}
                onPress={() => {
                  void onSave();
                }}
                disabled={!valid || saveDiet.isPending}
                loading={saveDiet.isPending}
              />
              <Button label={t('diary.diet.cancel')} variant="secondary" onPress={onClose} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  panel: {
    maxHeight: '94%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
