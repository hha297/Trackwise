import { Image } from 'expo-image';
import { Droplets, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { weekDateKeys } from '@/features/diary/aggregations';
import { useProfile } from '@/features/goals/hooks';
import {
  QUICK_ADD_ML,
  flOzToMl,
  intakeForDate,
  mlToFlOz,
  progressRatio,
  weekIntake,
  type HydrationEntry,
} from '@/features/hydration/calculations';
import { HydrationWeekChart } from '@/features/hydration/hydration-week-chart';
import { useHydration, useHydrationMutations } from '@/features/hydration/hooks';
import { useAppLanguage } from '@/i18n';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey } from '@/utils/date';

const WATER_IMAGE = require('../../../assets/images/branding/images/water.jpg');

function formatAmount(ml: number, imperial: boolean): string {
  if (imperial) return `${mlToFlOz(ml)} fl oz`;
  return `${ml} ml`;
}

function formatAxis(ml: number, imperial: boolean): string {
  if (imperial) return String(Math.round(mlToFlOz(ml)));
  if (ml >= 1000) return `${Math.round(ml / 100) / 10}L`;
  return String(ml);
}

function formatLoggedTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function HydrationCard({ dateKey }: { dateKey: string }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const locale = useAppLanguage();
  const profile = useProfile();
  const imperial = profile.data?.units === 'imperial';
  const query = useHydration(dateKey);
  const mutations = useHydrationMutations(dateKey);
  const [custom, setCustom] = useState('');
  const [target, setTarget] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const weekday = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );

  const entries = query.data?.entries ?? [];
  const dayEntries = entries.filter((entry) => entry.loggedOn === dateKey);
  const total = intakeForDate(entries, dateKey);
  const targetMl = query.data?.targetMl ?? 2500;
  const ratio = Math.min(1, progressRatio(total, targetMl));
  const weekKeys = weekDateKeys(dateKey);
  const week = weekIntake(entries, weekKeys);
  const chartDays = week.map((day) => ({
    dateKey: day.dateKey,
    amountMl: day.amountMl,
    label: weekday.format(parseDiaryDateKey(day.dateKey)),
    isToday: day.dateKey === dateKey,
  }));

  function parseAmount(raw: string): number | null {
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return null;
    return imperial ? flOzToMl(value) : Math.round(value);
  }

  function saveCustom() {
    const amount = parseAmount(custom);
    if (amount == null) return;
    if (editingId) {
      mutations.update.mutate({ id: editingId, amountMl: amount });
      setEditingId(null);
    } else {
      mutations.add.mutate(amount);
    }
    setCustom('');
  }

  function beginEdit(entry: HydrationEntry) {
    setEditingId(entry.id);
    setCustom(imperial ? String(mlToFlOz(entry.amountMl)) : String(entry.amountMl));
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Image
          source={WATER_IMAGE}
          style={{ width: 48, height: 48, borderRadius: radii.sm }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="headingSmall">{t('phase1.hydrationTitle')}</Text>
          <Text variant="headingMedium" tone="brand">
            {formatAmount(total, imperial)}
          </Text>
        </View>
      </View>
      {query.isError ? (
        <Text variant="caption" tone="error">
          {t('phase1.loadError')}
        </Text>
      ) : (
        <>
          <Text variant="bodySmall" tone="secondary">
            {t('phase1.progress', {
              current: formatAmount(total, imperial),
              goal: formatAmount(targetMl, imperial),
            })}
          </Text>
          <View
            style={{
              height: 8,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceMuted,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(ratio * 100)}%`,
                height: 8,
                borderRadius: radii.pill,
                backgroundColor: colors.info,
              }}
            />
          </View>
          <View className="flex-row gap-2">
            {QUICK_ADD_ML.map((amount) => (
              <Pressable
                key={amount}
                accessibilityRole="button"
                onPress={() => mutations.add.mutate(amount)}
                style={{
                  flex: 1,
                  minHeight: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text variant="caption">{formatAmount(amount, imperial)}</Text>
              </Pressable>
            ))}
          </View>
          <Input
            label={editingId ? t('phase1.saveIntake') : t('phase1.customAmount')}
            value={custom}
            onChangeText={setCustom}
            keyboardType="decimal-pad"
            placeholder={imperial ? '8' : '300'}
          />
          <Button
            label={editingId ? t('phase1.saveIntake') : t('phase1.add')}
            onPress={saveCustom}
            loading={mutations.add.isPending || mutations.update.isPending}
          />

          <View className="gap-2">
            <Text variant="label" tone="secondary">
              {t('phase1.intakeLog')}
            </Text>
            {dayEntries.length ? (
              dayEntries.map((entry) => (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    paddingVertical: spacing[2],
                    paddingHorizontal: spacing[3],
                    borderRadius: radii.md,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radii.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Droplets size={18} color={colors.info} strokeWidth={1.75} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => beginEdit(entry)}
                    style={{ flex: 1, minWidth: 0, gap: 2 }}
                  >
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {formatAmount(entry.amountMl, imperial)}
                    </Text>
                    <Text variant="fine" tone="secondary" numberOfLines={1}>
                      {formatLoggedTime(entry.createdAt, locale)}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('phase1.deleteIntake')}
                    onPress={() => mutations.remove.mutate(entry.id)}
                    hitSlop={8}
                    style={{
                      width: 40,
                      height: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radii.sm,
                    }}
                  >
                    <Trash2 size={iconSizes.sm} color={colors.error} strokeWidth={1.75} />
                  </Pressable>
                </View>
              ))
            ) : (
              <View
                style={{
                  paddingVertical: spacing[4],
                  paddingHorizontal: spacing[3],
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: 'center',
                }}
              >
                <Text variant="bodySmall" tone="muted" style={{ textAlign: 'center' }}>
                  {t('phase1.emptyDay')}
                </Text>
              </View>
            )}
          </View>

          <Text variant="label" tone="secondary">
            {t('phase1.weekTotal')}
          </Text>
          <HydrationWeekChart
            days={chartDays}
            formatY={(ml) => formatAxis(ml, imperial)}
          />
          <Input
            label={t('phase1.targetLabel')}
            value={target}
            onChangeText={setTarget}
            keyboardType="number-pad"
            placeholder={formatAmount(targetMl, imperial)}
          />
          <Button
            label={t('phase1.saveTarget')}
            variant="secondary"
            loading={mutations.target.isPending}
            onPress={() => {
              const amount = parseAmount(target);
              if (amount == null) return;
              mutations.target.mutate(amount);
              setTarget('');
            }}
          />
        </>
      )}
    </Card>
  );
}
