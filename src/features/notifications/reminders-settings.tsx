import { Bell, BellOff, Droplets, Dumbbell, Utensils } from 'lucide-react-native';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { SettingsSwitch } from '@/components/ui/settings-switch';
import { Text } from '@/components/ui/text';
import { HeaderDoneButton } from '@/features/account/header-done-button';
import { SettingsSection } from '@/features/account/settings-row';
import { HYDRATION_INTERVAL_OPTIONS_MINUTES } from '@/features/notifications/defaults';
import { useReminderPreferences } from '@/features/notifications/hooks';
import { openSystemNotificationSettings } from '@/features/notifications/service';
import { TimeField } from '@/features/notifications/time-field';
import type { IsoWeekday, MealReminderKind } from '@/features/notifications/types';
import { useAppLanguage } from '@/i18n';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
const MEALS: MealReminderKind[] = ['breakfast', 'lunch', 'dinner'];

function weekdayLabel(iso: IsoWeekday, locale: string): string {
  // 2024-01-01 was Monday — stable ISO weekday anchors.
  const date = new Date(2024, 0, iso);
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
}

/** Section header: copy on the left, switch on the right — always a row. */
function SectionHeader({
  icon,
  title,
  description,
  switchValue,
  onSwitchChange,
  switchLabel,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  switchValue: boolean;
  onSwitchChange: (next: boolean) => void;
  switchLabel: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <View style={styles.sectionTitleRow}>
          {icon}
          <Text variant="bodyStrong" style={styles.sectionTitleText} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          {description}
        </Text>
      </View>
      <SettingsSwitch
        value={switchValue}
        accessibilityLabel={switchLabel}
        onValueChange={onSwitchChange}
      />
    </View>
  );
}

export function RemindersSettings() {
  const { t } = useTranslation();
  const locale = useAppLanguage();
  const colors = useThemeColors();
  const { prefs, permission, loading, error, permissionBlocked, patch } =
    useReminderPreferences();

  const permissionLabel = useMemo(() => {
    if (!permission) return t('notifications.permission.checking');
    switch (permission.status) {
      case 'granted':
        return t('notifications.permission.granted');
      case 'denied':
        return t('notifications.permission.denied');
      case 'unavailable':
        return t('notifications.permission.unavailable');
      default:
        return t('notifications.permission.undetermined');
    }
  }, [permission, t]);

  const permissionHint = useMemo(() => {
    if (!permission) return null;
    if (permission.canNotify) return t('notifications.permission.grantedHint');
    if (permission.status === 'undetermined') return t('notifications.permission.undeterminedHint');
    return t('notifications.permission.deniedHint');
  }, [permission, t]);

  if (loading || !prefs) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text variant="bodySmall" tone="secondary">
          {t('notifications.loading')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="headingLarge">{t('notifications.title')}</Text>
          <Text variant="bodySmall" tone="secondary">
            {t('notifications.subtitle')}
          </Text>
        </View>
        <HeaderDoneButton />
      </View>

      <SettingsSection title={t('notifications.permission.section')}>
        <View style={styles.permissionRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
            {permission?.canNotify ? (
              <Bell size={iconSizes.md} color={colors.primary} strokeWidth={2.2} />
            ) : (
              <BellOff size={iconSizes.md} color={colors.textMuted} strokeWidth={2.2} />
            )}
          </View>
          <View style={styles.permissionCopy}>
            <Text variant="bodyStrong" numberOfLines={2}>
              {permissionLabel}
            </Text>
            {permissionHint ? (
              <Text variant="caption" tone="muted">
                {permissionHint}
              </Text>
            ) : null}
          </View>
        </View>
        {permission && !permission.canNotify && permission.status === 'denied' ? (
          <View style={styles.permissionAction}>
            <Button
              label={t('notifications.permission.openSettings')}
              variant="secondary"
              onPress={() => {
                void openSystemNotificationSettings();
              }}
            />
          </View>
        ) : null}
        {permissionBlocked && !permission?.canNotify ? (
          <Text variant="caption" tone="secondary" style={styles.banner}>
            {t('notifications.permission.savedButBlocked')}
          </Text>
        ) : null}
      </SettingsSection>

      <SettingsSection title={t('notifications.workout.section')}>
        <View style={styles.cardBody}>
          <SectionHeader
            icon={<Dumbbell size={16} color={colors.primary} strokeWidth={2.2} />}
            title={t('notifications.workout.title')}
            description={t('notifications.workout.hint')}
            switchValue={prefs.workout.enabled}
            switchLabel={t('notifications.workout.title')}
            onSwitchChange={(enabled) => {
              patch((current) => ({
                ...current,
                workout: { ...current.workout, enabled },
              }));
            }}
          />

          <View
            style={[styles.controls, !prefs.workout.enabled && styles.dimmed]}
            pointerEvents={prefs.workout.enabled ? 'auto' : 'none'}
          >
            <TimeField
              label={t('notifications.workout.time')}
              value={prefs.workout.time}
              disabled={!prefs.workout.enabled}
              onChange={(time) => {
                patch((current) => ({
                  ...current,
                  workout: { ...current.workout, time },
                }));
              }}
            />

            <Text variant="caption" tone="muted">
              {t('notifications.workout.days')}
            </Text>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((day) => {
                const selected = prefs.workout.weekdays.includes(day);
                const label = weekdayLabel(day, locale);
                return (
                  <Pressable
                    key={day}
                    cssInterop={false}
                    disabled={!prefs.workout.enabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                    onPress={() => {
                      patch((current) => {
                        const set = new Set(current.workout.weekdays);
                        if (set.has(day)) set.delete(day);
                        else set.add(day);
                        return {
                          ...current,
                          workout: {
                            ...current.workout,
                            weekdays: [...set].sort((a, b) => a - b) as IsoWeekday[],
                          },
                        };
                      });
                    }}
                    style={[
                      styles.weekdayChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      numberOfLines={1}
                      style={{ color: selected ? colors.textOnPrimary : colors.textPrimary }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {prefs.workout.enabled && prefs.workout.weekdays.length === 0 ? (
              <Text variant="caption" tone="secondary">
                {t('notifications.workout.noDays')}
              </Text>
            ) : null}
          </View>
        </View>
      </SettingsSection>

      <SettingsSection title={t('notifications.meals.section')}>
        <View style={styles.cardBody}>
          <View style={styles.mealsIntro}>
            <View style={styles.sectionTitleRow}>
              <Utensils size={16} color={colors.primary} strokeWidth={2.2} />
              <Text variant="bodyStrong" style={styles.sectionTitleText} numberOfLines={2}>
                {t('notifications.meals.title')}
              </Text>
            </View>
            <Text variant="caption" tone="muted">
              {t('notifications.meals.hint')}
            </Text>
          </View>

          {MEALS.map((meal, index) => {
            const mealPrefs = prefs.meals[meal];
            return (
              <View
                key={meal}
                style={[
                  styles.mealBlock,
                  index < MEALS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                    paddingBottom: spacing[3],
                  },
                ]}
              >
                <View style={styles.mealHeader}>
                  <Text variant="bodyStrong" style={styles.mealName} numberOfLines={1}>
                    {t(`meals.${meal}`)}
                  </Text>
                  <SettingsSwitch
                    value={mealPrefs.enabled}
                    accessibilityLabel={t(`meals.${meal}`)}
                    onValueChange={(enabled) => {
                      patch((current) => ({
                        ...current,
                        meals: {
                          ...current.meals,
                          [meal]: { ...current.meals[meal], enabled },
                        },
                      }));
                    }}
                  />
                </View>
                <View
                  style={!mealPrefs.enabled ? styles.dimmed : null}
                  pointerEvents={mealPrefs.enabled ? 'auto' : 'none'}
                >
                  <TimeField
                    variant="chip"
                    label={t(`meals.${meal}`)}
                    value={mealPrefs.time}
                    disabled={!mealPrefs.enabled}
                    onChange={(time) => {
                      patch((current) => ({
                        ...current,
                        meals: {
                          ...current.meals,
                          [meal]: { ...current.meals[meal], time },
                        },
                      }));
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </SettingsSection>

      <SettingsSection title={t('notifications.hydration.section')}>
        <View style={styles.cardBody}>
          <SectionHeader
            icon={<Droplets size={16} color={colors.primary} strokeWidth={2.2} />}
            title={t('notifications.hydration.title')}
            description={t('notifications.hydration.hint')}
            switchValue={prefs.hydration.enabled}
            switchLabel={t('notifications.hydration.title')}
            onSwitchChange={(enabled) => {
              patch((current) => ({
                ...current,
                hydration: { ...current.hydration, enabled },
              }));
            }}
          />

          <View
            style={[styles.controls, !prefs.hydration.enabled && styles.dimmed]}
            pointerEvents={prefs.hydration.enabled ? 'auto' : 'none'}
          >
            <TimeField
              label={t('notifications.hydration.start')}
              value={prefs.hydration.windowStart}
              disabled={!prefs.hydration.enabled}
              onChange={(windowStart) => {
                patch((current) => ({
                  ...current,
                  hydration: { ...current.hydration, windowStart },
                }));
              }}
            />
            <TimeField
              label={t('notifications.hydration.end')}
              value={prefs.hydration.windowEnd}
              disabled={!prefs.hydration.enabled}
              onChange={(windowEnd) => {
                patch((current) => ({
                  ...current,
                  hydration: { ...current.hydration, windowEnd },
                }));
              }}
            />

            <Text variant="caption" tone="muted">
              {t('notifications.hydration.interval')}
            </Text>
            <View style={styles.intervalRow}>
              {HYDRATION_INTERVAL_OPTIONS_MINUTES.map((minutes) => {
                const selected = prefs.hydration.intervalMinutes === minutes;
                return (
                  <Pressable
                    key={minutes}
                    cssInterop={false}
                    disabled={!prefs.hydration.enabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      patch((current) => ({
                        ...current,
                        hydration: { ...current.hydration, intervalMinutes: minutes },
                      }));
                    }}
                    style={[
                      styles.intervalChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      numberOfLines={1}
                      style={{ color: selected ? colors.textOnPrimary : colors.textPrimary }}
                    >
                      {t('notifications.hydration.intervalOption', { minutes })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </SettingsSection>

      {error ? (
        <Text variant="bodySmall" tone="error">
          {t('notifications.saveError')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  headerText: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: spacing[1],
  },
  loading: {
    gap: spacing[3],
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  permissionCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 2,
  },
  permissionAction: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  banner: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: {
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  sectionHeaderCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: spacing[1],
    paddingTop: spacing[1],
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  sectionTitleText: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  mealsIntro: {
    gap: spacing[1],
  },
  controls: {
    gap: spacing[3],
  },
  dimmed: {
    opacity: 0.4,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  weekdayChip: {
    minWidth: 40,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealBlock: {
    gap: spacing[2],
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 44,
  },
  mealName: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  intervalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  intervalChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
