import { Screen } from '@/components/ui/screen';
import { RemindersSettings } from '@/features/notifications/reminders-settings';

export default function RemindersScreen() {
  return (
    <Screen scroll edges={['top', 'bottom', 'left', 'right']}>
      <RemindersSettings />
    </Screen>
  );
}
