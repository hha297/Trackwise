import { Column, LinearProgressIndicator, Text } from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
} from '@expo/ui/jetpack-compose/modifiers';
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
  const muted = dark ? '#A3A3A3' : '#646464';
  const primary = '#00D95F';
  const track = dark ? '#2A2A2A' : '#E4E0D8';
  const statusColor = props.completed ? primary : muted;

  return (
    <Column
      modifiers={[fillMaxSize(), background(surface), cornerRadius(20), paddingAll(14)]}
      horizontalAlignment="start"
    >
      <Text color={muted} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
        {props.title}
      </Text>
      <Text
        color={text}
        style={{ fontSize: 22, fontWeight: 'bold' }}
        maxLines={2}
        overflow="ellipsis"
        modifiers={[fillMaxWidth(), padding(0, 6, 0, 4)]}
      >
        {props.headline}
      </Text>
      {props.statusLabel ? (
        <Text color={statusColor} style={{ fontSize: 13, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
          {props.statusLabel}
        </Text>
      ) : null}
      {props.detail ? (
        <Text
          color={text}
          style={{ fontSize: 13 }}
          maxLines={1}
          overflow="ellipsis"
          modifiers={[padding(0, 2, 0, 0)]}
        >
          {props.detail}
        </Text>
      ) : null}
      {props.completed ? (
        <LinearProgressIndicator
          progress={1}
          color={primary}
          trackColor={track}
          modifiers={[fillMaxWidth(), height(6), padding(0, 10, 0, 0)]}
        />
      ) : null}
      {props.hint ? (
        <Text
          color={muted}
          style={{ fontSize: 13 }}
          maxLines={2}
          overflow="ellipsis"
          modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}
        >
          {props.hint}
        </Text>
      ) : null}
    </Column>
  );
};

export default createWidget('TrackwiseWorkout', TrackwiseWorkout, UNSIGNED_WORKOUT_WIDGET_PROPS);
