import { Pressable, View, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { getTemplateCover } from '@/features/workout/template-assets';
import {
  localizedEquipmentSummary,
  localizedTemplateDescription,
  localizedTemplateName,
} from '@/features/workout/template-i18n';
import type { WorkoutTemplate } from '@/features/workout/types';
import { radii, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type TemplateCardProps = {
  template: WorkoutTemplate;
  onPress: () => void;
  wide?: boolean;
};

export function TemplateCard({ template, onPress, wide = false }: TemplateCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const cover = getTemplateCover(template);

  const metaParts: string[] = [];
  if (template.difficulty) {
    metaParts.push(t(`workout.difficulty.${template.difficulty}`));
  }
  if (template.estimated_minutes) {
    metaParts.push(t('workout.templateMinutes', { count: template.estimated_minutes }));
  }
  if (template.goal) {
    metaParts.push(t(`workout.templateGoal.${template.goal}`, { defaultValue: template.goal }));
  }
  const meta = metaParts.join(' · ');
  const displayName = localizedTemplateName(t, template.name, {
    isSystem: template.is_system,
  });
  const categoryLabel = template.category
    ? t(`workout.category.${template.category}`, { defaultValue: template.category })
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={displayName}
      onPress={onPress}
      className="overflow-hidden"
      style={{
        width: wide ? '100%' : undefined,
        height: wide ? 156 : 172,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      {({ pressed }) => (
        <>
          <Image
            source={cover}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              transform: [{ scale: pressed ? 1.04 : 1 }],
            }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: withAlpha('#000000', pressed ? 0.5 : 0.36),
            }}
          />
          <View
            className="flex-1 justify-end gap-1 px-3"
            style={{ paddingBottom: 12, paddingTop: 18 }}
          >
            <Text variant="caption" style={{ color: withAlpha('#FFFFFF', 0.85) }} numberOfLines={1}>
              {template.is_system ? t('workout.systemTemplate') : t('workout.custom')}
              {categoryLabel ? ` · ${categoryLabel}` : ''}
            </Text>
            <Text variant="headingSmall" style={{ color: '#FFFFFF' }} numberOfLines={2}>
              {displayName}
            </Text>
            {meta ? (
              <Text variant="caption" style={{ color: colors.primary }} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
            {template.equipment_summary ? (
              <Text
                variant="caption"
                style={{ color: withAlpha('#FFFFFF', 0.78) }}
                numberOfLines={1}
              >
                {localizedEquipmentSummary(t, template.equipment_summary, {
                  isSystem: template.is_system,
                })}
              </Text>
            ) : template.description ? (
              <Text
                variant="caption"
                style={{ color: withAlpha('#FFFFFF', 0.78) }}
                numberOfLines={2}
              >
                {localizedTemplateDescription(t, template.name, template.description, {
                  isSystem: template.is_system,
                })}
              </Text>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}
