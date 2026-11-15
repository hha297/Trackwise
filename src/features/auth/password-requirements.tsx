import { Check, Circle, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/theme/theme-provider';

import { evaluatePasswordRules } from './password-rules';

type PasswordRequirementsProps = {
  password: string;
  /** False until the user has interacted — rows stay neutral. */
  interactive: boolean;
};

export function PasswordRequirements({ password, interactive }: PasswordRequirementsProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const results = evaluatePasswordRules(password);

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={t('auth.password')}
      style={{ gap: 6, minHeight: 108 }}
    >
      {results.map((rule) => {
        const status = !interactive ? 'neutral' : rule.met ? 'pass' : 'fail';
        const color =
          status === 'pass' ? colors.success : status === 'fail' ? colors.error : colors.textMuted;
        const Icon = status === 'pass' ? Check : status === 'fail' ? X : Circle;

        return (
          <View key={rule.id} className="flex-row items-center gap-2">
            <Icon
              size={status === 'neutral' ? 12 : 14}
              color={color}
              strokeWidth={status === 'neutral' ? 2 : 2.5}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text variant="caption" style={{ color, flex: 1 }}>
              {t(rule.labelKey)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
