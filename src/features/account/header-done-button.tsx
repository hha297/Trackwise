import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ChromeIconButton } from '@/components/ui/chrome-icon-button';

type HeaderDoneButtonProps = {
  onPress?: () => void;
};

/** Header dismiss. Same muted icon button as screen close. */
export function HeaderDoneButton({ onPress }: HeaderDoneButtonProps) {
  const { t } = useTranslation();

  return (
    <ChromeIconButton
      label={t('account.done')}
      header
      onPress={onPress ?? (() => router.back())}
      icon={(color) => <X size={22} color={color} />}
    />
  );
}
