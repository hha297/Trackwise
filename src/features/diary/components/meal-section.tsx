import { ChevronDown, ChevronUp, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { FoodEntryEditModal } from '@/features/diary/components/food-entry-edit-modal';
import { FoodLogEntryCard } from '@/features/diary/components/food-log-entry-card';
import { MEAL_IMAGES } from '@/features/diary/meal-assets';
import { useUpdateFoodEntryAmount } from '@/features/food/hooks';
import type { FoodEntry, MealType } from '@/features/food/types';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type MealSectionProps = {
  meal: MealType;
  dateKey: string;
  entries: FoodEntry[];
  onAdd: () => void;
  onDelete: (id: string) => void;
};

export function MealSection({
  meal,
  dateKey,
  entries,
  onAdd,
  onDelete,
}: MealSectionProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const updateAmount = useUpdateFoodEntryAmount();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const mealCalories = Math.round(entries.reduce((sum, entry) => sum + entry.calories, 0));
  const mealImage = MEAL_IMAGES[meal];
  const hasContent = entries.length > 0;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={t(`meals.${meal}`)}
          onPress={() => setOpen((current) => !current)}
          className="min-w-0 flex-1 flex-row items-center gap-3"
        >
          <Image
            source={mealImage}
            style={{ width: 48, height: 48, borderRadius: radii.sm }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="headingSmall">{t(`meals.${meal}`)}</Text>
            <Text variant="headingMedium" tone="brand">
              {mealCalories} {t('diary.meals.kcalUnit')}
            </Text>
          </View>
          {open ? (
            <ChevronUp size={iconSizes.md} color={colors.textMuted} />
          ) : (
            <ChevronDown size={iconSizes.md} color={colors.textMuted} />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diary.meals.add')}
          onPress={onAdd}
          className="h-10 w-10 items-center justify-center"
          style={{
            backgroundColor: colors.primary,
            borderRadius: radii.pill,
          }}
        >
          <Plus size={20} color={colors.textOnPrimary} strokeWidth={2.5} />
        </Pressable>
      </View>

      {open ? (
        !hasContent ? (
          <View
            className="items-start gap-2 px-3 py-3"
            style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md }}
          >
            <Text variant="bodySmall" tone="muted">
              {t('diary.meals.empty')}
            </Text>
            <Pressable accessibilityRole="button" onPress={onAdd}>
              <Text variant="label" tone="brand">
                {t('diary.meals.add')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: spacing[3] }}>
            {entries.map((entry) => (
              <FoodLogEntryCard
                key={entry.id}
                entry={entry}
                mealImage={mealImage}
                onEdit={() => setEditing(entry)}
              />
            ))}
          </View>
        )
      ) : null}

      <FoodEntryEditModal
        entry={editing}
        saving={updateAmount.isPending}
        onClose={() => setEditing(null)}
        onDelete={
          editing
            ? () => {
                const id = editing.id;
                setEditing(null);
                onDelete(id);
              }
            : undefined
        }
        onSave={async (input) => {
          if (!editing) return;
          await updateAmount.mutateAsync({
            id: editing.id,
            dateKey,
            ...input,
          });
          setEditing(null);
        }}
      />
    </Card>
  );
}
