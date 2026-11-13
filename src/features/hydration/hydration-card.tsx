import { useState } from 'react';
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
} from '@/features/hydration/calculations';
import { useHydration, useHydrationMutations } from '@/features/hydration/hooks';
import { useAppLanguage } from '@/i18n';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey } from '@/utils/date';

function formatAmount(ml: number, imperial: boolean): string {
  if (imperial) return `${mlToFlOz(ml)} fl oz`;
  return `${ml} ml`;
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
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });

  const entries = query.data?.entries ?? [];
  const dayEntries = entries.filter((entry) => entry.loggedOn === dateKey);
  const total = intakeForDate(entries, dateKey);
  const targetMl = query.data?.targetMl ?? 2500;
  const ratio = Math.min(1, progressRatio(total, targetMl));
  const week = weekIntake(entries, weekDateKeys(dateKey));

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

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="headingSmall">{t('phase1.hydrationTitle')}</Text>
        <Text variant="caption" tone="secondary">
          {formatAmount(total, imperial)}
        </Text>
      </View>
      {query.isError ? (
        <Text variant="caption" tone="error">{t('phase1.loadError')}</Text>
      ) : (
        <>
          <Text variant="bodySmall" tone="secondary">
            {t('phase1.progress', {
              current: formatAmount(total, imperial),
              goal: formatAmount(targetMl, imperial),
            })}
          </Text>
          <View style={{ height: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
            <View
              style={{
                width: `${Math.round(ratio * 100)}%`,
                height: 8,
                borderRadius: radii.pill,
                backgroundColor: colors.primary,
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
          {dayEntries.length ? (
            dayEntries.map((entry) => (
              <View key={entry.id} className="flex-row items-center justify-between gap-3">
                <Pressable
                  onPress={() => {
                    setEditingId(entry.id);
                    setCustom(imperial ? String(mlToFlOz(entry.amountMl)) : String(entry.amountMl));
                  }}
                >
                  <Text variant="bodySmall">{formatAmount(entry.amountMl, imperial)}</Text>
                </Pressable>
                <Pressable onPress={() => mutations.remove.mutate(entry.id)} hitSlop={8}>
                  <Text variant="caption" tone="error">{t('phase1.deleteIntake')}</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text variant="caption" tone="muted">{t('phase1.emptyDay')}</Text>
          )}
          <Text variant="label" tone="secondary">{t('phase1.weekTotal')}</Text>
          <View className="flex-row justify-between gap-1">
            {week.map((day) => {
              const filled = day.amountMl > 0;
              return (
                <View key={day.dateKey} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <Text variant="caption" tone="secondary">
                    {weekday.format(parseDiaryDateKey(day.dateKey))}
                  </Text>
                  <View
                    style={{
                      width: '100%',
                      height: 6,
                      borderRadius: radii.pill,
                      backgroundColor: filled ? colors.primary : colors.surfaceMuted,
                    }}
                  />
                </View>
              );
            })}
          </View>
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
