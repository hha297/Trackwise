import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useThemeColors } from '@/theme/theme-provider';

import { Button } from './button';
import { Text } from './text';

type Props = {
  title: string;
  body: string;
  onRetry?: () => void;
};

export function ErrorState({ title, body, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-3 px-4 py-8">
      <Text variant="headingSmall" className="text-center">
        {title}
      </Text>
      <Text variant="body" tone="secondary" className="text-center">
        {body}
      </Text>
      {onRetry ? <Button label={t('common.retry')} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const resolved = label ?? t('common.loading');

  return (
    <View className="items-center justify-center gap-2.5 py-6">
      <ActivityIndicator color={colors.primary} size="small" />
      <Text variant="caption" tone="secondary">
        {resolved}
      </Text>
    </View>
  );
}
