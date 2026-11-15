import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { brand, radii, spacing } from '@/theme';
import { fonts } from '@/theme/fonts';

const LOGO_SIZE = 112;
const LOGO_RADIUS = radii.lg; // 16

/**
 * Branded launch surface shown while bootstrap runs.
 * Matches native splash green so the handoff from expo-splash-screen stays seamless.
 */
export function SplashBrandScreen() {
  const { t } = useTranslation();

  return (
    <View
      style={[styles.root, { backgroundColor: brand.primary }]}
      accessibilityLabel={`${t('splash.appName')}. ${t('splash.tagline')}`}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../../../assets/images/branding/logo-splash.png')}
              style={styles.logo}
              contentFit="cover"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>

          <RNText style={styles.appName} accessibilityRole="header">
            {t('splash.appName')}
          </RNText>

          <Text variant="body" style={styles.tagline}>
            {t('splash.tagline')}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    gap: spacing[3],
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_RADIUS,
    overflow: 'hidden',
    marginBottom: spacing[2],
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_RADIUS,
  },
  appName: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1,
    color: '#0D110D',
    textAlign: 'center',
  },
  tagline: {
    color: 'rgba(13, 17, 13, 0.72)',
    textAlign: 'center',
    maxWidth: 280,
  },
});
