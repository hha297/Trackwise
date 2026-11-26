import { router, type Href } from 'expo-router';
import { Compass, Undo2, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import type { FoodEntry } from '@/features/food/types';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

import { useTodayGuidance } from '../hooks';
import { presentCompanionCard } from '../presentation';
import type { CompanionCtaHref } from '../types';

type TodayGuidanceCardProps = {
  dateKey: string;
  todayKey: string;
  entries: Pick<FoodEntry, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[];
  workouts: { started_at: string; status?: string | null }[];
};

function pushHref(href: CompanionCtaHref, params?: Record<string, string>) {
  if (params && Object.keys(params).length > 0) {
    router.push({ pathname: href, params } as Href);
    return;
  }
  router.push(href as Href);
}

export function TodayGuidanceCard({
  dateKey,
  todayKey,
  entries,
  workouts,
}: TodayGuidanceCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const guidance = useTodayGuidance({ dateKey, todayKey, entries, workouts });

  if (dateKey !== todayKey) return null;

  if (guidance.loading && !guidance.suggestion && !guidance.comeback.eligible) {
    return (
      <Card>
        <LoadingState />
      </Card>
    );
  }

  if (guidance.error && !guidance.suggestion && !guidance.comeback.eligible) {
    return (
      <Card>
        <ErrorState
          title={t('companion.loadError')}
          body={t('companion.retry')}
          onRetry={() => guidance.refetch()}
        />
      </Card>
    );
  }

  if (guidance.comeback.eligible) {
    return (
      <Card>
        <View className="flex-row items-start gap-3">
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Undo2 size={iconSizes.md} color={colors.primary} />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="headingSmall">{t('companion.comeback.title')}</Text>
            <Text variant="bodySmall" tone="secondary">
              {t('companion.comeback.body')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('companion.dismiss')}
            onPress={() => void guidance.dismissComeback()}
            hitSlop={8}
          >
            <X size={18} color={colors.textMuted} />
          </Pressable>
        </View>
        <View className="mt-3 gap-2">
          <Button
            label={t('companion.comeback.continuePlan')}
            onPress={() => {
              void guidance.dismissComeback();
              pushHref('/workout/plan');
            }}
          />
          <Button
            variant="secondary"
            label={t('companion.comeback.reviewGoals')}
            onPress={() => {
              void guidance.dismissComeback();
              pushHref('/goals');
            }}
          />
          <Button
            variant="text"
            label={t('companion.comeback.simpleActivity')}
            onPress={() => {
              void guidance.dismissComeback();
              pushHref('/(tabs)/workout');
            }}
          />
          <Button
            variant="text"
            label={t('companion.comeback.openDiary')}
            onPress={() => {
              void guidance.dismissComeback();
              pushHref('/food/add', { intent: 'log', date: dateKey });
            }}
          />
        </View>
      </Card>
    );
  }

  if (!guidance.suggestion) return null;

  const presented = presentCompanionCard(guidance.suggestion);

  return (
    <Card
      accessibilityRole="summary"
      accessibilityLabel={t(presented.a11yKey, {
        title: t(presented.titleKey, presented.interpolation),
      })}
    >
      <View className="flex-row items-start gap-3">
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Compass size={iconSizes.md} color={colors.primary} />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="label" tone="secondary">
            {t('companion.kicker')}
          </Text>
          <Text variant="headingSmall">
            {t(presented.titleKey, presented.interpolation)}
          </Text>
          <Text variant="bodySmall" tone="secondary">
            {t(presented.bodyKey, presented.interpolation)}
          </Text>
        </View>
        {guidance.suggestion.dismissible ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(presented.dismissKey)}
            onPress={() => void guidance.dismiss(guidance.suggestion!)}
            hitSlop={8}
          >
            <X size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ marginTop: spacing[3] }}>
        <Button
          label={t(presented.ctaKey, presented.interpolation)}
          onPress={() => pushHref(presented.href, presented.params)}
        />
      </View>
    </Card>
  );
}
