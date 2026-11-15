import { Gauge, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  gaugeStyle,
  padding,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import {
  UNSIGNED_WORKOUT_WIDGET_PROPS,
  type WorkoutWidgetProps,
} from '@/features/widgets/models';

const TrackwiseWorkout = (props: WorkoutWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark =
    props.colorScheme === 'dark' || (!props.colorScheme && environment.colorScheme === 'dark');
  const surface = dark ? '#111111' : '#F9F7F3';
  const text = dark ? '#FCFCFC' : '#202020';
  const muted = dark ? 'rgba(252,252,252,0.55)' : '#646464';
  const primary = '#00D95F';
  const openUrl = props.openUrl || 'trackwise:///workout/plan';
  const body = 'Bricolage Grotesque';
  const mono = 'JetBrains Mono';
  const family = environment.widgetFamily ?? 'systemMedium';
  const statusColor = props.completed ? primary : muted;

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        padding({ all: 14 }),
        containerBackground(surface, 'widget'),
        widgetURL(openUrl),
      ]}
    >
      <Text modifiers={[font({ family: body, size: 12, weight: 'semibold' }), foregroundStyle(muted)]}>
        {props.title}
      </Text>
      <Text
        modifiers={[font({ family: body, size: family === 'systemSmall' ? 18 : 22, weight: 'bold' }), foregroundStyle(text)]}
      >
        {props.headline}
      </Text>
      {props.statusLabel ? (
        <Text modifiers={[font({ family: body, size: 13, weight: 'medium' }), foregroundStyle(statusColor)]}>
          {props.statusLabel}
        </Text>
      ) : null}
      {family !== 'systemSmall' && props.detail ? (
        <Text modifiers={[font({ family: mono, size: 13, weight: 'semibold' }), foregroundStyle(text)]}>
          {props.detail}
        </Text>
      ) : null}
      {props.completed ? (
        <Gauge value={1} min={0} max={1} modifiers={[gaugeStyle('linearCapacity'), tint(primary)]} />
      ) : null}
      {props.hint ? (
        <>
          <Spacer />
          <Text modifiers={[font({ family: body, size: 13, weight: 'medium' }), foregroundStyle(muted)]}>
            {props.hint}
          </Text>
        </>
      ) : null}
    </VStack>
  );
};

export default createWidget('TrackwiseWorkout', TrackwiseWorkout, UNSIGNED_WORKOUT_WIDGET_PROPS);
