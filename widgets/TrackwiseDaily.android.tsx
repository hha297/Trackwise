import {
  CircularProgressIndicator,
  Column,
  LinearProgressIndicator,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  size,
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
  const track = dark ? '#3F3F3F' : '#C9C3B8';
  const calorieHeadline = props.caloriesRatio || props.caloriesValue;
  const remainingLine = props.signedIn
    ? props.caloriesRemainingLine ||
      (props.remainingValue !== '—'
        ? `${props.remainingValue} ${props.remainingLabel}`
        : props.hint)
    : props.hint;
  const overTarget =
    props.signedIn &&
    props.caloriesProgress >= 1 &&
    props.remainingValue !== '—' &&
    props.remainingValue !== '0';
  const proteinRatio = props.proteinRatio || props.proteinValue;
  const fatRatio = props.fatRatio || props.fatValue;
  const carbsRatio = props.carbsRatio || props.carbsValue;

  return (
    <Column
      modifiers={[fillMaxSize(), background(surface), cornerRadius(20), paddingAll(10)]}
      horizontalAlignment="center"
      verticalAlignment="center"
    >
      <Row
        modifiers={[fillMaxWidth(), padding(0, 0, 0, 8)]}
        horizontalArrangement="center"
        verticalAlignment="center"
      >
        <CircularProgressIndicator
          progress={props.caloriesProgress}
          color={calories}
          trackColor={track}
          strokeWidth={10}
          strokeCap="round"
          modifiers={[size(104, 104), padding(0, 0, 8, 0)]}
        />
        <Column modifiers={[width(176)]} horizontalAlignment="start">
          <Text color={muted} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
            {props.title}
          </Text>
          <Text color={text} style={{ fontSize: 20, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
            {calorieHeadline}
          </Text>
          <Text color={muted} style={{ fontSize: 12 }} maxLines={1}>
            {props.caloriesLabel}
          </Text>
          {remainingLine ? (
            <Text
              color={overTarget ? fat : text}
              style={{ fontSize: 12, fontWeight: 'bold' }}
              maxLines={1}
              overflow="ellipsis"
            >
              {remainingLine}
            </Text>
          ) : null}
        </Column>
      </Row>
      <Row
        modifiers={[fillMaxWidth(), padding(0, 0, 0, 6)]}
        horizontalArrangement="center"
        verticalAlignment="top"
      >
        <Column modifiers={[width(148), background(cell), cornerRadius(12), paddingAll(8)]}>
          <Text color={carbs} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
            {props.carbsLabel}
          </Text>
          <Text color={text} style={{ fontSize: 15, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
            {carbsRatio}
          </Text>
          <LinearProgressIndicator
            progress={props.carbsProgress}
            color={carbs}
            trackColor={track}
            modifiers={[width(132), height(4), padding(0, 4, 0, 2)]}
          />
          {props.carbsRemainingLine ? (
            <Text color={muted} style={{ fontSize: 11 }} maxLines={1} overflow="ellipsis">
              {props.carbsRemainingLine}
            </Text>
          ) : null}
        </Column>
        <Column modifiers={[width(148), background(cell), cornerRadius(12), paddingAll(8)]}>
          <Text color={protein} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
            {props.proteinLabel}
          </Text>
          <Text color={text} style={{ fontSize: 15, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
            {proteinRatio}
          </Text>
          <LinearProgressIndicator
            progress={props.proteinProgress}
            color={protein}
            trackColor={track}
            modifiers={[width(132), height(4), padding(0, 4, 0, 2)]}
          />
          {props.proteinRemainingLine ? (
            <Text color={muted} style={{ fontSize: 11 }} maxLines={1} overflow="ellipsis">
              {props.proteinRemainingLine}
            </Text>
          ) : null}
        </Column>
      </Row>
      <Row modifiers={[fillMaxWidth()]} horizontalArrangement="center" verticalAlignment="top">
        <Column modifiers={[width(148), background(cell), cornerRadius(12), paddingAll(8)]}>
          <Text color={fat} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
            {props.fatLabel}
          </Text>
          <Text color={text} style={{ fontSize: 15, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
            {fatRatio}
          </Text>
          <LinearProgressIndicator
            progress={props.fatProgress}
            color={fat}
            trackColor={track}
            modifiers={[width(132), height(4), padding(0, 4, 0, 2)]}
          />
          {props.fatRemainingLine ? (
            <Text color={muted} style={{ fontSize: 11 }} maxLines={1} overflow="ellipsis">
              {props.fatRemainingLine}
            </Text>
          ) : null}
        </Column>
        <Column modifiers={[width(148), background(cell), cornerRadius(12), paddingAll(8)]}>
          <Text color={water} style={{ fontSize: 11, fontWeight: 'bold' }} maxLines={1}>
            {props.waterLabel}
          </Text>
          <Text color={text} style={{ fontSize: 15, fontWeight: 'bold' }} maxLines={1} overflow="ellipsis">
            {props.waterValue}
          </Text>
          <LinearProgressIndicator
            progress={props.waterProgress}
            color={water}
            trackColor={track}
            modifiers={[width(132), height(4), padding(0, 4, 0, 2)]}
          />
          {props.waterRemainingLine ? (
            <Text color={muted} style={{ fontSize: 11 }} maxLines={1} overflow="ellipsis">
              {props.waterRemainingLine}
            </Text>
          ) : null}
        </Column>
      </Row>
    </Column>
  );
};

export default createWidget('TrackwiseDaily', TrackwiseDaily, UNSIGNED_DAILY_WIDGET_PROPS);
