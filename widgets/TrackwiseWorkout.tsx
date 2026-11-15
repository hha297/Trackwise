import {
  UNSIGNED_WORKOUT_WIDGET_PROPS,
  type WorkoutWidgetProps,
} from '@/features/widgets/models';

/** Web/SSR stub — home screen widgets are native-only. */
const stub = {
  updateSnapshot(_props: WorkoutWidgetProps) {},
  reload() {},
  updateTimeline() {},
};

export default stub;
export { UNSIGNED_WORKOUT_WIDGET_PROPS };
