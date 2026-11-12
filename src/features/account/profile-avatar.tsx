import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/fonts';
import { useThemeColors } from '@/theme/theme-provider';

import { profileInitial } from './avatar';

type ProfileAvatarProps = {
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
};

export function ProfileAvatar({
  displayName,
  email,
  avatarUrl,
  size = 72,
}: ProfileAvatarProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !failed;
  const initial = profileInitial(displayName, email);
  const fontSize = Math.round(size * 0.38);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={
        displayName
          ? t('account.avatarA11y', { name: displayName })
          : t('account.profileAvatarA11y')
      }
    >
      {showImage ? (
        <Image
          source={{ uri: avatarUrl! }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={{
            fontFamily: fonts.ibmBold,
            fontSize,
            lineHeight: fontSize + 4,
            color: colors.primary,
          }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
