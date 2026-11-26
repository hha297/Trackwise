import { Gauge, Grid, HStack, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  padding,
  progressViewStyle,
  shapes,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
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
  const muted = dark ? 'rgba(252,252,252,0.62)' : '#646464';
  const primary = '#00D95F';
  const carbs = '#A56B2A';
  const protein = '#3E6F8A';
  const fat = '#8A5A6A';
  const water = '#3B82F6';
  const family = environment.widgetFamily ?? 'systemMedium';
  const openUrl = props.openUrl || 'trackwise:///';
  const body = 'Bricolage Grotesque';
  const mono = 'JetBrains Mono';
  const proteinRatio = props.proteinRatio || props.proteinValue;
  const fatRatio = props.fatRatio || props.fatValue;
  const carbsRatio = props.carbsRatio || props.carbsValue;
  const calorieHeadline = props.caloriesRatio || props.caloriesValue;
  const remainingLine =
    props.caloriesRemainingLine ||
    (props.remainingValue !== '—' ? `${props.remainingValue} ${props.remainingLabel}` : props.hint);

  const calorieRing = (ring: number, valueSize: number) => (
    <ZStack alignment="center" modifiers={[frame({ width: ring, height: ring })]}>
      <Gauge
        value={props.caloriesProgress}
        min={0}
        max={1}
        modifiers={[
          gaugeStyle('circularCapacity'),
          tint(primary),
          frame({ width: ring, height: ring }),
        ]}
      />
      <VStack alignment="center" spacing={0}>
        <Text modifiers={[font({ family: mono, size: valueSize, weight: 'bold' }), foregroundStyle(text)]}>
          {props.caloriesValue}
        </Text>
        <Text modifiers={[font({ family: body, size: 10, weight: 'medium' }), foregroundStyle(muted)]}>
          {props.caloriesLabel}
        </Text>
      </VStack>
    </ZStack>
  );

  const metricCard = (
    label: string,
    ratio: string,
    progress: number,
    remaining: string,
    color: string,
  ) => (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[
        padding({ all: 10 }),
        background(cell, shapes.roundedRectangle({ cornerRadius: 14 })),
      ]}
    >
      <Text modifiers={[font({ family: body, size: 12, weight: 'semibold' }), foregroundStyle(color)]}>
        {label}
      </Text>
      <Text modifiers={[font({ family: mono, size: 15, weight: 'bold' }), foregroundStyle(text)]}>
        {ratio}
      </Text>
      <ProgressView
        value={progress}
        modifiers={[progressViewStyle('linear'), tint(color), frame({ height: 4 })]}
      />
      {remaining ? (
        <Text modifiers={[font({ family: body, size: 11, weight: 'medium' }), foregroundStyle(muted)]}>
          {remaining}
        </Text>
      ) : null}
    </VStack>
  );

  const compactMetric = (label: string, ratio: string, progress: number, color: string) => (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={6} alignment="center">
        <Text modifiers={[font({ family: body, size: 11, weight: 'semibold' }), foregroundStyle(color)]}>
          {label}
        </Text>
        <Spacer />
        <Text modifiers={[font({ family: mono, size: 12, weight: 'bold' }), foregroundStyle(text)]}>
          {ratio}
        </Text>
      </HStack>
      <ProgressView
        value={progress}
        modifiers={[progressViewStyle('linear'), tint(color), frame({ height: 4 })]}
      />
    </VStack>
  );

  const metricGrid = (
    <Grid alignment="leading" horizontalSpacing={8} verticalSpacing={8}>
      <Grid.Row>
        {metricCard(props.carbsLabel, carbsRatio, props.carbsProgress, props.carbsRemainingLine, carbs)}
        {metricCard(
          props.proteinLabel,
          proteinRatio,
          props.proteinProgress,
          props.proteinRemainingLine,
          protein,
        )}
      </Grid.Row>
      <Grid.Row>
        {metricCard(props.fatLabel, fatRatio, props.fatProgress, props.fatRemainingLine, fat)}
        {metricCard(
          props.waterLabel,
          props.waterValue,
          props.waterProgress,
          props.waterRemainingLine,
          water,
        )}
      </Grid.Row>
    </Grid>
  );

  if (family === 'systemSmall') {
    return (
      <ZStack
        alignment="center"
        modifiers={[
          padding({ all: 10 }),
          containerBackground(surface, 'widget'),
          widgetURL(openUrl),
        ]}
      >
        <Gauge
          value={props.caloriesProgress}
          min={0}
          max={1}
          currentValueLabel={
            <VStack alignment="center" spacing={0}>
              <Text modifiers={[font({ family: mono, size: 20, weight: 'bold' }), foregroundStyle(text)]}>
                {props.caloriesValue}
              </Text>
              <Text modifiers={[font({ family: body, size: 10, weight: 'medium' }), foregroundStyle(muted)]}>
                {props.caloriesLabel}
              </Text>
            </VStack>
          }
          modifiers={[gaugeStyle('circularCapacity'), tint(primary)]}
        />
      </ZStack>
    );
  }

  if (family === 'systemLarge') {
    return (
      <VStack
        alignment="center"
        spacing={12}
        modifiers={[
          padding({ all: 14 }),
          containerBackground(surface, 'widget'),
          widgetURL(openUrl),
        ]}
      >
        {calorieRing(128, 24)}
        <VStack alignment="center" spacing={2}>
          <Text modifiers={[font({ family: mono, size: 16, weight: 'bold' }), foregroundStyle(text)]}>
            {calorieHeadline}
          </Text>
          {remainingLine ? (
            <Text modifiers={[font({ family: body, size: 12, weight: 'medium' }), foregroundStyle(muted)]}>
              {remainingLine}
            </Text>
          ) : null}
        </VStack>
        {metricGrid}
      </VStack>
    );
  }

  return (
    <HStack
      spacing={12}
      alignment="center"
      modifiers={[
        padding({ all: 12 }),
        containerBackground(surface, 'widget'),
        widgetURL(openUrl),
      ]}
    >
      {calorieRing(96, 18)}
      <VStack alignment="leading" spacing={4}>
        <Text modifiers={[font({ family: mono, size: 15, weight: 'bold' }), foregroundStyle(text)]}>
          {calorieHeadline}
        </Text>
        {remainingLine ? (
          <Text modifiers={[font({ family: body, size: 11, weight: 'medium' }), foregroundStyle(muted)]}>
            {remainingLine}
          </Text>
        ) : null}
        {compactMetric(props.carbsLabel, carbsRatio, props.carbsProgress, carbs)}
        {compactMetric(props.proteinLabel, proteinRatio, props.proteinProgress, protein)}
        {compactMetric(props.fatLabel, fatRatio, props.fatProgress, fat)}
        {compactMetric(props.waterLabel, props.waterValue, props.waterProgress, water)}
      </VStack>
    </HStack>
  );
};

export default createWidget('TrackwiseDaily', TrackwiseDaily, UNSIGNED_DAILY_WIDGET_PROPS);
