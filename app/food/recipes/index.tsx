import { router, type Href } from 'expo-router';
import { BookOpen, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useRecipes } from '@/features/recipes/hooks';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

export default function RecipesIndexScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [term, setTerm] = useState('');
  const recipes = useRecipes(term);

  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ gap: spacing[4] }}>
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('recipes.libraryTitle')}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text variant="bodyStrong" tone="brand">
              {t('common.close')}
            </Text>
          </Pressable>
        </View>
        <Text variant="bodySmall" tone="secondary">
          {t('recipes.librarySubtitle')}
        </Text>

        <Button
          label={t('recipes.createCta')}
          iconStart={(color) => <Plus size={16} color={color} />}
          onPress={() => router.push('/food/recipes/new' as Href)}
        />

        <Input
          label={t('recipes.searchLibrary')}
          value={term}
          onChangeText={setTerm}
          placeholder={t('recipes.searchLibraryPlaceholder')}
          autoCapitalize="none"
        />

        {recipes.isLoading ? <LoadingState /> : null}
        {recipes.error ? (
          <ErrorState
            title={t('recipes.loadError')}
            body={recipes.error instanceof Error ? recipes.error.message : t('recipes.retry')}
            onRetry={() => void recipes.refetch()}
          />
        ) : null}

        {!recipes.isLoading && !recipes.error && (recipes.data ?? []).length === 0 ? (
          <Card style={{ gap: spacing[2] }}>
            <Text variant="bodyStrong">{t('recipes.emptyTitle')}</Text>
            <Text variant="bodySmall" tone="muted">
              {t('recipes.emptyBody')}
            </Text>
          </Card>
        ) : null}

        <View style={{ gap: spacing[2] }}>
          {(recipes.data ?? []).map((recipe) => (
            <Pressable
              key={recipe.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/food/recipes/[id]', params: { id: recipe.id } })
              }
            >
              <Card>
                <View className="flex-row items-center gap-3">
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radii.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <BookOpen size={20} color={colors.primary} />
                  </View>
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text variant="bodyStrong" numberOfLines={2}>
                      {recipe.name}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {t('recipes.listOpen')}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
