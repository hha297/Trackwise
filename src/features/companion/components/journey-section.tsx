import { Award, Dumbbell, Flame, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { iconSizes, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey } from '@/utils/date';

import { useJourneyMilestones } from '../hooks';
import { presentMilestone } from '../presentation';
import type { JourneyMilestone } from '../types';

type JourneySectionProps = {
  todayKey: string;
  locale: string;
};

export function JourneySection({ todayKey, locale }: JourneySectionProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { milestones, loading, error, refetch } = useJourneyMilestones(todayKey);

  if (loading && milestones.length === 0) {
    return (
      <Card>
        <Text variant="headingSmall">{t('companion.journey.title')}</Text>
        <LoadingState />
      </Card>
    );
  }

  if (error && milestones.length === 0) {
    return (
      <Card>
        <ErrorState
          title={t('companion.journey.loadError')}
          body={t('companion.retry')}
          onRetry={() => refetch()}
        />
      </Card>
    );
  }

  return (
    <Card>
      <View className="gap-1">
        <Text variant="headingSmall">{t('companion.journey.title')}</Text>
        <Text variant="bodySmall" tone="secondary">
          {t('companion.journey.subtitle')}
        </Text>
      </View>

      {milestones.length === 0 ? (
        <Text variant="bodySmall" tone="secondary" style={{ marginTop: spacing[3] }}>
          {t('companion.journey.empty')}
        </Text>
      ) : (
        <View className="gap-3" style={{ marginTop: spacing[3] }}>
          {milestones.map((row) => (
            <MilestoneRow key={row.id} row={row} locale={locale} colors={colors} />
          ))}
        </View>
      )}
    </Card>
  );
}

function MilestoneRow({
  row,
  locale,
  colors,
}: {
  row: JourneyMilestone;
  locale: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const { t } = useTranslation();
  const presented = presentMilestone(row);
  const Icon =
    row.category === 'workout' ? Dumbbell : row.category === 'nutrition' ? Utensils : Flame;
  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseDiaryDateKey(row.achievedOn));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${t(presented.titleKey)}. ${t(presented.categoryKey)}. ${dateLabel}`}
      className="flex-row items-start gap-3"
    >
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
        <Icon size={iconSizes.sm} color={colors.primary} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="bodyStrong">{t(presented.titleKey)}</Text>
        <Text variant="bodySmall" tone="secondary">
          {t(presented.bodyKey, { count: presented.stat ?? 0 })}
        </Text>
        <Text variant="caption" tone="muted">
          {t(presented.categoryKey)} · {dateLabel}
        </Text>
      </View>
      <Award size={iconSizes.sm} color={colors.textMuted} />
    </View>
  );
}
