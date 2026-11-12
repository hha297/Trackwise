import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LoadingState } from '@/components/ui/states';
import { Screen } from '@/components/ui/screen';
import { ActivityStep } from '@/features/setup/steps/activity-step';
import { BodyStep } from '@/features/setup/steps/body-step';
import { DietaryStep } from '@/features/setup/steps/dietary-step';
import { ExerciseStep } from '@/features/setup/steps/exercise-step';
import { GoalStep } from '@/features/setup/steps/goal-step';
import { SafetyStep } from '@/features/setup/steps/safety-step';
import { SummaryStep } from '@/features/setup/steps/summary-step';
import { TargetStep } from '@/features/setup/steps/target-step';
import { useSetup } from '@/features/setup/setup-provider';

export default function SetupScreen() {
  const { t } = useTranslation();
  const { ready, step } = useSetup();

  if (!ready) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <View className="flex-1 justify-center">
          <LoadingState label={t('setup.loading')} />
        </View>
      </Screen>
    );
  }

  switch (step) {
    case 'goal':
      return <GoalStep />;
    case 'safety':
      return <SafetyStep />;
    case 'body':
      return <BodyStep />;
    case 'activity':
      return <ActivityStep />;
    case 'exercise':
      return <ExerciseStep />;
    case 'target':
      return <TargetStep />;
    case 'dietary':
      return <DietaryStep />;
    case 'summary':
      return <SummaryStep />;
    default:
      return <GoalStep />;
  }
}
