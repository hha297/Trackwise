import { Column, LinearProgressIndicator, Row, Text } from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import {
  UNSIGNED_DAILY_WIDGET_PROPS,
  type DailyWidgetProps,
} from '@/features/widgets/models';

const TrackwiseDaily = (props: DailyWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark =
    props.colorScheme === 'dark' || (!props.colorScheme && environment.colorScheme === 'dark');
  const surface = dark ? '#111111' : '#F9F7F3';
  const cell = dark ? '#1C1C1C' : '#FFFFFF';
  const text = dark ? '#FCFCFC' : '#202020';
  const muted = dark ? '#A3A3A3' : '#646464';
  const calories = '#00D95F';
  const protein = '#3E6F8A';
  const fat = '#8A5A6A';
  const carbs = '#A56B2A';
  const water = '#3B82F6';
  const track = dark ? '#2A2A2A' : '#E4E0D8';
  const remainingLine = props.signedIn
    ? props.remainingValue + ' ' + props.remainingLabel
    : props.hint;
  const proteinRatio = props.proteinRatio || props.proteinValue;
  const fatRatio = props.fatRatio || props.fatValue;
  const carbsRatio = props.carbsRatio || props.carbsValue;

  return (
    <Column
      modifiers={[fillMaxSize(), background(surface), cornerRadius(20), paddingAll(8)]}
      horizontalAlignment="center"
      verticalAlignment="center"
    >
      <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 4)]} horizontalAlignment="center">
        <Text color={muted} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
          {props.title}
        </Text>
        <Text color={calories} style={{ fontSize: 28, fontWeight: 'bold' }} maxLines={1}>
          {props.caloriesValue}
        </Text>
        <Text color={muted} style={{ fontSize: 12 }} maxLines={1}>
          {props.caloriesLabel}
        </Text>
        <Text color={text} style={{ fontSize: 12, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
          {remainingLine}
        </Text>
      </Column>
      <Row
        modifiers={[fillMaxWidth(), padding(0, 0, 0, 4)]}
        horizontalArrangement="center"
        verticalAlignment="top"
      >
        <Column modifiers={[width(140), background(cell), cornerRadius(12), paddingAll(8)]}>
          <Text color={carbs} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
            {props.carbsLabel}
          </Text>
          <Text color={text} style={{ fontSize: 16, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
            {carbsRatio}
          </Text>
          <LinearProgressIndicator
            progress={props.carbsProgress}
            color={carbs}
            trackColor={track}
            modifiers={[width(124), height(4), padding(0, 4, 0, 2)]}
          />
          <Text color={muted} style={{ fontSize: 11 }} maxLines={1} overflow="ellipsis">
            {props.carbsRemainingLine}
          </Text>
        </Column>
        <Column modifiers={[width(140), background(cell), cornerRadius(12), paddingAll(8)]}>
          <Text color={protein} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
            {props.proteinLabel}
          </Text>
          <Text color={text} style={{ fontSize: 16, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
            {proteinRatio}
          </Text>
          <LinearProgressIndicator
            progress={props.proteinProgress}
            color={protein}
            trackColor={track}
            modifiers={[width(124), height(4), padding(0, 4, 0, 2)]}
          />
          <Text color={muted} style={{ fontSize: 11 }} maxLines={1} overflow="ellipsis">
            {props.proteinRemainingLine}
          </Text>
        </Column>
      </Row>
      <Row modifiers={[fillMaxWidth()]} horizontalArrangement="center" verticalAlignment="top">
        <Column modifiers={[width(140), background(cell), cornerRadius(12), paddingAll(8)]}>
          <Text color={fat} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
            {props.fatLabel}
          </Text>
          <Text color={text} style={{ fontSize: 16, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
            {fatRatio}
          </Text>
          <LinearProgressIndicator
            progress={props.fatProgress}
            color={fat}
            trackColor={track}
            modifiers={[width(124), height(4), padding(0, 4, 0, 2)]}
          />
          <Text color={muted} style={{ fontSize: 11 }} maxLines={1} overflow="ellipsis">
            {props.fatRemainingLine}
          </Text>
        </Column>
        <Column modifiers={[width(140), background(cell), cornerRadius(12), paddingAll(8)]}>
          <Text color={water} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
            {props.waterLabel}
          </Text>
          <Text color={text} style={{ fontSize: 16, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
            {props.waterValue}
          </Text>
          <LinearProgressIndicator
            progress={props.waterProgress}
            color={water}
            trackColor={track}
            modifiers={[width(124), height(4), padding(0, 4, 0, 2)]}
          />
          <Text color={muted} style={{ fontSize: 11 }} maxLines={1} overflow="ellipsis">
            {props.waterRemainingLine}
          </Text>
        </Column>
      </Row>
    </Column>
  );
};

export default createWidget('TrackwiseDaily', TrackwiseDaily, UNSIGNED_DAILY_WIDGET_PROPS);
