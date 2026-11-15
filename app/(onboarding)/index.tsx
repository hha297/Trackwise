import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { FloatingBackgroundDecor } from '@/components/floating-background-decor';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useBootstrap } from '@/features/bootstrap/bootstrap-provider';
import { reportError } from '@/lib/errors/report-error';
import { elevation, radii, spacing, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const STEP_KEYS = ['meals', 'glance', 'train', 'goals'] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { completeOnboarding } = useBootstrap();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const stepKey = STEP_KEYS[index];
  const isLast = index === STEP_KEYS.length - 1;

  async function finish(href: '/(auth)/sign-up' | '/(auth)/sign-in') {
    if (busy) return;
    setBusy(true);
    try {
      await completeOnboarding();
      router.replace(href);
    } catch (error) {
      reportError(error, { area: 'onboarding', action: 'complete' });
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FloatingBackgroundDecor />
      <SafeAreaView style={{ flex: 1, zIndex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
        <View className="flex-1 justify-between px-5 py-3">
          <View className="items-end">
            {!isLast ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.skipA11y')}
                disabled={busy}
                onPress={() => {
                  void finish('/(auth)/sign-up');
                }}
                hitSlop={12}
              >
                <Text variant="bodyStrong" style={{ color: colors.primary }}>
                  {t('onboarding.skip')}
                </Text>
              </Pressable>
            ) : (
              <View className="h-5" />
            )}
          </View>

          <View className="items-center gap-8">
            <BrandMark size="md" />

            <View
              className="w-full px-5 py-6"
              style={[
                elevation.card('#000000'),
                {
                  backgroundColor: colors.surface,
                  borderRadius: radii.md,
                  paddingHorizontal: spacing[5],
                  paddingVertical: spacing[6],
                },
              ]}
            >
              <Text variant="display" className="mb-3">
                {t(`onboarding.steps.${stepKey}.title`)}
              </Text>
              <Text variant="body" tone="secondary">
                {t(`onboarding.steps.${stepKey}.body`)}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              {STEP_KEYS.map((key, stepIndex) => (
                <View
                  key={key}
                  style={{
                    height: 8,
                    width: stepIndex === index ? 24 : 8,
                    borderRadius: radii.pill,
                    backgroundColor:
                      stepIndex === index
                        ? colors.primary
                        : stepIndex < index
                          ? withAlpha(colors.primary, 0.45)
                          : colors.surfaceMuted,
                  }}
                />
              ))}
            </View>
          </View>

          <View className="gap-3 pb-2">
            <Button
              label={isLast ? t('onboarding.getStarted') : t('onboarding.next')}
              variant="primary"
              size="lg"
              loading={busy && isLast}
              disabled={busy}
              onPress={() => {
                if (isLast) {
                  void finish('/(auth)/sign-up');
                  return;
                }
                setIndex((value) => value + 1);
              }}
            />
            {isLast ? (
              <Pressable
                disabled={busy}
                onPress={() => {
                  void finish('/(auth)/sign-in');
                }}
                className="items-center py-2"
              >
                <Text variant="bodyStrong" style={{ color: colors.primary }}>
                  {t('onboarding.alreadyHaveAccount')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
