import { addDays } from 'date-fns';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { weekDateKeys } from '@/features/diary/aggregations';
import { usePlanMutations, useWeekPlans } from '@/features/planner/hooks';
import { planStatus } from '@/features/planner/status';
import { useWorkoutTemplates } from '@/features/workout/hooks';
import { getTemplateCover } from '@/features/workout/template-assets';
import { localizedEquipmentSummary, localizedTemplateName } from '@/features/workout/template-i18n';
import { useAppLanguage } from '@/i18n';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

export default function WeeklyPlanScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const locale = useAppLanguage();
  const [anchor, setAnchor] = useState(toDiaryDateKey());
  const [selectedDate, setSelectedDate] = useState(toDiaryDateKey());
  const today = toDiaryDateKey();
  const days = weekDateKeys(anchor);
  const plans = useWeekPlans(anchor);
  const templates = useWorkoutTemplates();
  const mutations = usePlanMutations();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const dayPlans = (plans.data ?? []).filter((plan) => plan.planDate === selectedDate);

  function shiftWeek(direction: -1 | 1) {
    const next = toDiaryDateKey(addDays(parseDiaryDateKey(anchor), direction * 7));
    setAnchor(next);
    setSelectedDate(weekDateKeys(next)[0]!);
  }

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="headingLarge" className="min-w-0 flex-1">{t('phase1.planTitle')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text variant="bodyStrong" tone="brand">{t('workout.back')}</Text>
          </Pressable>
        </View>
        <Text variant="bodySmall" tone="secondary">{t('phase1.planHint')}</Text>

        <View className="flex-row items-center justify-between">
          <Pressable accessibilityRole="button" onPress={() => shiftWeek(-1)} hitSlop={8}>
            <ChevronLeft size={22} color={colors.textPrimary} />
          </Pressable>
          <Text variant="bodyStrong">
            {days[0]?.slice(5)} – {days[6]?.slice(5)}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => shiftWeek(1)} hitSlop={8}>
            <ChevronRight size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View className="flex-row justify-between">
          {days.map((day) => {
            const selected = day === selectedDate;
            const hasPlan = (plans.data ?? []).some((plan) => plan.planDate === day);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                onPress={() => setSelectedDate(day)}
                style={{ alignItems: 'center', width: 40 }}
              >
                <Text variant="caption" tone="secondary">
                  {weekday.format(parseDiaryDateKey(day)).replace(/\.$/, '')}
                </Text>
                <View
                  style={{
                    marginTop: 6,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? colors.primary : 'transparent',
                    borderWidth: day === today && !selected ? 1.5 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text variant="bodyStrong" style={{ color: selected ? colors.textOnPrimary : colors.textPrimary }}>
                    {parseDiaryDateKey(day).getDate()}
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 4,
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: hasPlan ? colors.primary : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        {plans.isLoading ? <LoadingState /> : null}
        {plans.isError ? (
          <ErrorState title={t('phase1.loadError')} body={t('workout.retry')} onRetry={() => void plans.refetch()} />
        ) : null}

        {dayPlans.length === 0 && !plans.isLoading ? (
          <Text variant="bodySmall" tone="muted">{t('phase1.emptyPlanDay')}</Text>
        ) : null}

        {dayPlans.map((plan) => {
          const status = planStatus({
            kind: plan.kind,
            planDate: plan.planDate,
            todayKey: today,
            completedWorkoutId: plan.completedWorkoutId,
          });
          const template = (templates.data ?? []).find((item) => item.id === plan.templateId);
          const label = template
            ? localizedTemplateName(t, template.name, { isSystem: template.is_system })
            : plan.kind === 'workout'
              ? plan.title ?? t('phase1.workout')
              : t(`phase1.kind.${plan.kind}`);
          return (
            <Card key={plan.id} className="flex-row items-center gap-3" style={{ padding: 10 }}>
              {template ? (
                <Image
                  source={getTemplateCover(template)}
                  style={{ width: 64, height: 64, borderRadius: radii.md }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: radii.md,
                    backgroundColor: colors.surfaceMuted,
                  }}
                />
              )}
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="bodyStrong" numberOfLines={2}>{label}</Text>
                <Text variant="caption" tone="secondary">{t(`phase1.status.${status}`)}</Text>
                <View className="flex-row flex-wrap gap-3">
                  {!plan.completedWorkoutId ? (
                    <>
                      <Pressable
                        onPress={() =>
                          mutations.update.mutate({
                            id: plan.id,
                            planDate: toDiaryDateKey(addDays(parseDiaryDateKey(plan.planDate), -1)),
                            kind: plan.kind,
                            templateId: plan.templateId,
                            title: plan.title,
                          })
                        }
                      >
                        <Text variant="caption" tone="brand">{t('phase1.moveEarlier')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          mutations.update.mutate({
                            id: plan.id,
                            planDate: toDiaryDateKey(addDays(parseDiaryDateKey(plan.planDate), 1)),
                            kind: plan.kind,
                            templateId: plan.templateId,
                            title: plan.title,
                          })
                        }
                      >
                        <Text variant="caption" tone="brand">{t('phase1.moveLater')}</Text>
                      </Pressable>
                    </>
                  ) : null}
                  <Pressable onPress={() => mutations.remove.mutate(plan.id)}>
                    <Text variant="caption" tone="error">{t('phase1.removePlan')}</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          );
        })}

        {dayPlans.some((plan) => plan.kind === 'workout' && plan.templateId && !plan.completedWorkoutId) ? (
          <Button
            label={t('workout.startTemplate')}
            onPress={() => {
              const plan = dayPlans.find((item) => item.kind === 'workout' && item.templateId && !item.completedWorkoutId);
              if (!plan?.templateId) return;
              router.push({ pathname: '/workout/templates/[id]', params: { id: plan.templateId } });
            }}
          />
        ) : null}

        <View className="flex-row gap-2">
          <View style={{ flex: 1 }}>
            <Button label={t('phase1.addRest')} variant="secondary" onPress={() => mutations.create.mutate({ planDate: selectedDate, kind: 'rest' })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t('phase1.addRecovery')} variant="secondary" onPress={() => mutations.create.mutate({ planDate: selectedDate, kind: 'recovery' })} />
          </View>
        </View>

        <Text variant="headingSmall">{t('phase1.assignTemplate')}</Text>
        {(templates.data ?? []).map((template) => (
          <Pressable
            key={template.id}
            accessibilityRole="button"
            onPress={() =>
              mutations.create.mutate({
                planDate: selectedDate,
                kind: 'workout',
                templateId: template.id,
                title: localizedTemplateName(t, template.name, { isSystem: template.is_system }),
              })
            }
          >
            <Card className="flex-row items-center gap-3" style={{ padding: 10 }}>
              <Image
                source={getTemplateCover(template)}
                style={{ width: 56, height: 56, borderRadius: radii.md }}
                resizeMode="cover"
              />
              <View className="min-w-0 flex-1">
                <Text variant="bodyStrong" numberOfLines={1}>
                  {localizedTemplateName(t, template.name, { isSystem: template.is_system })}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {template.equipment_summary
                    ? localizedEquipmentSummary(t, template.equipment_summary, { isSystem: template.is_system })
                    : t(`workout.category.${template.category}`, { defaultValue: template.category })}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
        {mutations.create.isError ? <Text variant="caption" tone="error">{t('phase1.planSaveError')}</Text> : null}
      </View>
    </Screen>
  );
}
