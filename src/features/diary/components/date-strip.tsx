import { addDays } from 'date-fns';
import { useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/theme/theme-provider';
import { parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

type DateStripProps = {
  selectedKey: string;
  todayKey: string;
  locale: string;
  onSelect: (key: string) => void;
  dayWidth?: number;
};

type DayItem = {
  key: string;
  dayNum: string;
  weekday: string;
};

const WINDOW_RADIUS = 14;
const STRIP_HEIGHT = 78;

function buildWindow(centerKey: string, locale: string): DayItem[] {
  const center = parseDiaryDateKey(centerKey);
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: WINDOW_RADIUS * 2 + 1 }, (_, index) => {
    const date = addDays(center, index - WINDOW_RADIUS);
    return {
      key: toDiaryDateKey(date),
      dayNum: String(date.getDate()),
      weekday: formatter.format(date).replace(/\.$/, ''),
    };
  });
}

export function DateStrip({
  selectedKey,
  todayKey,
  locale,
  onSelect,
  dayWidth = 48,
}: DateStripProps) {
  const colors = useThemeColors();
  const scrollRef = useRef<ElementRef<typeof ScrollView>>(null);
  const circleSize = 40;
  const [anchorKey, setAnchorKey] = useState(selectedKey);
  const days = useMemo(() => buildWindow(anchorKey, locale), [anchorKey, locale]);
  const selectedIndex = days.findIndex((d) => d.key === selectedKey);

  if (
    anchorKey !== selectedKey &&
    (selectedIndex < 0 || selectedIndex <= 2 || selectedIndex >= days.length - 3)
  ) {
    setAnchorKey(selectedKey);
  }

  useEffect(() => {
    if (selectedIndex < 0) return;
    const x = Math.max(0, selectedIndex * dayWidth - dayWidth * 2.5);
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedIndex, dayWidth, anchorKey]);

  return (
    <View style={{ height: STRIP_HEIGHT }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        nestedScrollEnabled
        style={{ height: STRIP_HEIGHT }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 4,
          minHeight: STRIP_HEIGHT,
        }}
      >
        {days.map((item) => {
          const selected = item.key === selectedKey;
          const isToday = item.key === todayKey;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.weekday} ${item.dayNum}`}
              onPress={() => onSelect(item.key)}
              style={{
                width: dayWidth,
                height: STRIP_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="fine" tone="secondary" numberOfLines={1} style={{ marginBottom: 4 }}>
                {item.weekday}
              </Text>
              <View
                style={{
                  width: circleSize,
                  height: circleSize,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: circleSize / 2,
                  backgroundColor: selected ? colors.primary : 'transparent',
                  borderWidth: !selected && isToday ? 1.5 : 0,
                  borderColor: colors.primary,
                }}
              >
                <Text
                  variant="bodyStrong"
                  style={{ color: selected ? colors.textOnPrimary : colors.textPrimary }}
                >
                  {item.dayNum}
                </Text>
              </View>
              <View
                style={{
                  marginTop: 4,
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: isToday ? colors.primary : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
