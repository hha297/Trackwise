import {
  UNSIGNED_DAILY_WIDGET_PROPS,
  type DailyWidgetProps,
} from '@/features/widgets/models';

/** Web/SSR stub — home screen widgets are native-only. */
const stub = {
  updateSnapshot(_props: DailyWidgetProps) {},
  reload() {},
  updateTimeline() {},
};

export default stub;
export { UNSIGNED_DAILY_WIDGET_PROPS };
