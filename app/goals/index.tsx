import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-provider';
import { useActiveGoal } from '@/features/goals/hooks';
import { getSupabase } from '@/lib/supabase/client';
import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const GOAL_TYPES = ['lose_weight', 'maintain_weight', 'gain_weight'] as const;

export default function GoalsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { session } = useAuth();
  const existing = useActiveGoal();
  const queryClient = useQueryClient();
  const [goalType, setGoalType] = useState<(typeof GOAL_TYPES)[number]>('maintain_weight');
  const [calories, setCalories] = useState(
    String(existing.data?.daily_calorie_target ?? 2000),
  );
  const [targetWeight, setTargetWeight] = useState(
    existing.data?.target_weight_kg != null ? String(existing.data.target_weight_kg) : '',
  );
  const [protein, setProtein] = useState(String(existing.data?.protein_g ?? 120));
  const [carbs, setCarbs] = useState(String(existing.data?.carbs_g ?? 200));
  const [fat, setFat] = useState(String(existing.data?.fat_g ?? 70));
  const [error, setError] = useState<string | null>(null);

  const goalLabels: Record<(typeof GOAL_TYPES)[number], string> = {
    lose_weight: t('goalsEdit.loseWeight'),
    maintain_weight: t('goalsEdit.maintain'),
    gain_weight: t('goalsEdit.gainWeight'),
  };

  const save = useMutation({
    mutationFn: async () => {
      const supabase = getSupabase();
      const userId = session?.user.id;
      if (!supabase || !userId) throw new Error(t('goalsEdit.signInRequired'));
      await supabase.from('goals').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
      const { error: insertError } = await supabase.from('goals').insert({
        user_id: userId,
        goal_type: goalType,
        daily_calorie_target: Number(calories) || 2000,
        target_weight_kg: targetWeight ? Number(targetWeight) : null,
        protein_g: Number(protein) || null,
        carbs_g: Number(carbs) || null,
        fat_g: Number(fat) || null,
        is_active: true,
      });
      if (insertError) throw insertError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['goal'] });
      router.back();
    },
    onError: (err) => setError(err instanceof Error ? err.message : t('goalsEdit.saveFailed')),
  });

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-4">
        <View className="flex-row items-start gap-2">
          <ChromeIconButton
            header
            label={t('goalsEdit.close')}
            onPress={() => router.back()}
            icon={(color) => <X size={22} color={color} />}
          />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('goalsEdit.title')}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {GOAL_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => setGoalType(type)}
              style={[
                styles.goalChip,
                {
                  backgroundColor: goalType === type ? colors.primary : colors.surfaceMuted,
                },
              ]}
            >
              <Text
                variant="label"
                tone={goalType === type ? 'onPrimary' : 'primary'}
              >
                {goalLabels[type]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Input
          label={t('goalsEdit.calories')}
          value={calories}
          onChangeText={setCalories}
          keyboardType="number-pad"
        />
        <Input
          label={t('goalsEdit.targetWeight')}
          value={targetWeight}
          onChangeText={setTargetWeight}
          keyboardType="decimal-pad"
        />
        <Input
          label={t('goalsEdit.protein')}
          value={protein}
          onChangeText={setProtein}
          keyboardType="number-pad"
        />
        <Input
          label={t('goalsEdit.carbs')}
          value={carbs}
          onChangeText={setCarbs}
          keyboardType="number-pad"
        />
        <Input
          label={t('goalsEdit.fat')}
          value={fat}
          onChangeText={setFat}
          keyboardType="number-pad"
        />
        {error ? (
          <Text variant="bodySmall" tone="error">
            {error}
          </Text>
        ) : null}
        <Button
          label={t('goalsEdit.save')}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  goalChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
});
