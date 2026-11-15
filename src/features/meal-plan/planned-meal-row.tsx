import { BookOpen, Trash2, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { NutritionMacrosRow } from '@/features/food/nutrition-macros-row';
import { PlannedMealIntake } from '@/features/meal-plan/planned-meal-intake';
import type { PlannedMeal } from '@/features/meal-plan/types';
import { scalePlannedMacros } from '@/features/recipes/calculations';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const THUMB = 40;

type PlannedMealRowProps = {
  meal: PlannedMeal;
  onOpenRecipe?: () => void;
  onRemove: () => void;
  onUpdateServings?: (nextServings: number, macros: ReturnType<typeof scalePlannedMacros>) => void;
  removing?: boolean;
};

/**
 * Food/Recipe identity in one surfaceMuted block (avatar + name + servings + macros).
 * Planned / Actual stay outside that block.
 */
export function PlannedMealRow({
  meal,
  onOpenRecipe,
  onRemove,
  onUpdateServings,
  removing,
}: PlannedMealRowProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isRecipe = meal.recipe_id != null;

  function confirmRemove() {
    Alert.alert(t('mealPlan.removeTitle'), t('mealPlan.removeBody', { title: meal.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mealPlan.removeConfirm'),
        style: 'destructive',
        onPress: onRemove,
      },
    ]);
  }

  return (
    <View
      style={{
        gap: spacing[3],
        paddingTop: spacing[3],
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {/* ONE section: avatar + name + servings + nutrients — surfaceMuted */}
      <View
        style={{
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[3],
          borderRadius: radii.md,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        <View className="flex-row items-center gap-2.5">
          <View
            style={{
              width: THUMB,
              height: THUMB,
              borderRadius: radii.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {isRecipe ? (
              <BookOpen size={18} color={colors.primary} />
            ) : (
              <Utensils size={18} color={colors.textSecondary} />
            )}
          </View>

          <Pressable
            className="min-w-0 flex-1 gap-0.5"
            disabled={!isRecipe || !onOpenRecipe}
            onPress={onOpenRecipe}
            accessibilityRole={isRecipe ? 'button' : undefined}
          >
            <Text variant="bodyStrong" numberOfLines={2}>
              {meal.title}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {isRecipe ? t('mealPlan.kindRecipe') : t('mealPlan.kindFood')} ·{' '}
              {t('mealPlan.servingsLabel', { count: meal.servings })}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mealPlan.removeConfirm')}
            onPress={confirmRemove}
            hitSlop={8}
            disabled={removing}
            style={{ padding: 6, opacity: removing ? 0.5 : 1 }}
          >
            <Trash2 size={iconSizes.md} color={colors.error} />
          </Pressable>
        </View>

        <View style={{ width: '100%', marginTop: spacing[2] }}>
          <NutritionMacrosRow
            compact
            onMutedSurface
            showCalories
            calories={meal.calories}
            proteinG={meal.protein_g}
            carbsG={meal.carbs_g}
            fatG={meal.fat_g}
          />
        </View>
      </View>

      {/* Planned / Actual — outside the muted identity section */}
      <PlannedMealIntake meal={meal} onUpdateServings={onUpdateServings} />
    </View>
  );
}
