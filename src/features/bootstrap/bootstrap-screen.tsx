import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type BootstrapScreenProps = {
  error?: string | null;
  onRetry?: () => void;
  /** Escape hatch when the session is stale (e.g. account deleted mid-onboarding). */
  onSignIn?: () => void;
};

/**
 * Compact bootstrap wait / error surface.
 * Happy-path startup keeps the native splash visible instead of this screen.
 */
export function BootstrapScreen({ error, onRetry, onSignIn }: BootstrapScreenProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <BrandMark size="sm" />

          {error ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text
                variant="headingSmall"
                style={[styles.centerText, { color: colors.textPrimary }]}
              >
                {t('bootstrap.prepareFailed')}
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.centerText, { color: colors.textMuted }]}
              >
                {error}
              </Text>
              <View style={styles.actions}>
                {onRetry ? (
                  <Button label={t('bootstrap.retry')} variant="primary" size="md" onPress={onRetry} />
                ) : null}
                {onSignIn ? (
                  <Button
                    label={t('bootstrap.backToSignIn')}
                    variant="secondary"
                    size="md"
                    onPress={onSignIn}
                  />
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.loading} accessibilityLabel={t('bootstrap.gettingReadyA11y')}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text variant="caption" style={{ color: colors.textMuted }}>
                {t('bootstrap.gettingReady')}
              </Text>
            </View>
          )}
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
    paddingHorizontal: spacing[6],
    gap: spacing[5],
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    gap: spacing[3],
  },
  centerText: {
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  loading: {
    alignItems: 'center',
    gap: spacing[3],
  },
});
