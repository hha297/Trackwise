import { ChevronLeft } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Text } from '@/components/ui/text';

type DiarySubScreenHeaderProps = {
  title: string;
  onBack: () => void;
};

export function DiarySubScreenHeader({ title, onBack }: DiarySubScreenHeaderProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-start gap-2">
      <ChromeIconButton
        header
        label={t('diary.nav.backToDiary')}
        onPress={onBack}
        icon={(color) => <ChevronLeft size={22} color={color} />}
      />
      <Text variant="headingLarge" className="flex-1" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}
