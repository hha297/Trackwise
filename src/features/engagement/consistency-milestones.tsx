import { useEffect, useState } from 'react';
import { Check, Target } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { CompactInput } from '@/components/ui/compact-input';
import { Text } from '@/components/ui/text';
import { buildMilestones } from '@/features/engagement/activity-days';
import {
  loadPersonalMilestone,
  parsePersonalMilestoneInput,
  PERSONAL_MILESTONE_MIN,
  savePersonalMilestone,
} from '@/features/engagement/personal-milestone';
import { radii, spacing, withAlpha } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

type ConsistencyMilestonesProps = {
  bestDays: number;
};

const MILESTONE_DESC_KEYS = {
  7: 'engagement.consistency.milestoneDesc7',
  14: 'engagement.consistency.milestoneDesc14',
  30: 'engagement.consistency.milestoneDesc30',
  60: 'engagement.consistency.milestoneDesc60',
  100: 'engagement.consistency.milestoneDesc100',
} as const;

/** Milestone list from overall best streak, plus optional personal goal after 100. */
export function ConsistencyMilestones({ bestDays }: ConsistencyMilestonesProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { items, next } = buildMilestones(bestDays);
  const allUnlocked = next === null;

  const [personalGoal, setPersonalGoal] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [inputError, setInputError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void loadPersonalMilestone(userId).then((value) => {
      if (cancelled) return;
      setPersonalGoal(value);
      if (value != null) setDraft(String(value));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function saveGoal() {
    if (!userId) return;
    const parsed = parsePersonalMilestoneInput(draft);
    if (parsed == null) {
      setInputError(true);
      return;
    }
    setInputError(false);
    setSaving(true);
    try {
      await savePersonalMilestone(userId, parsed);
      setPersonalGoal(parsed);
    } finally {
      setSaving(false);
    }
  }

  const effectiveGoal = userId ? personalGoal : null;
  const personalReached =
    effectiveGoal != null && bestDays >= effectiveGoal;
  const personalProgress =
    effectiveGoal != null
      ? Math.min(1, bestDays / Math.max(effectiveGoal, 1))
      : 0;

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ gap: 2 }}>
        <Text variant="headingSmall">{t('engagement.consistency.milestonesTitle')}</Text>
        <Text variant="caption" tone="muted">
          {t('engagement.consistency.milestonesHint')}
        </Text>
        {next ? (
          <Text variant="caption" tone="secondary">
            {t('engagement.consistency.nextMilestone', { count: next.days })}
          </Text>
        ) : effectiveGoal && !personalReached ? (
          <Text variant="caption" tone="secondary">
            {t('engagement.consistency.nextMilestone', { count: effectiveGoal })}
          </Text>
        ) : (
          <Text variant="caption" tone="secondary">
            {t('engagement.consistency.allMilestones')}
          </Text>
        )}
      </View>

      <View style={{ gap: spacing[2] }}>
        {items.map((item) => {
          const remaining = Math.max(0, item.days - bestDays);
          const progress = Math.min(1, bestDays / item.days);
          return (
            <View
              key={item.days}
              style={[
                styles.card,
                {
                  backgroundColor: item.unlocked
                    ? withAlpha(colors.primary, 0.12)
                    : colors.surfaceMuted,
                  borderColor: item.unlocked ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTitleRow}>
                  {item.unlocked ? (
                    <View
                      style={[
                        styles.checkWrap,
                        { backgroundColor: withAlpha(colors.primary, 0.2) },
                      ]}
                    >
                      <Check size={14} color={colors.primary} />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.checkWrap,
                        { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
                      ]}
                    >
                      <Target size={14} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {t('engagement.consistency.milestoneDays', { count: item.days })}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={2}>
                      {t(MILESTONE_DESC_KEYS[item.days])}
                    </Text>
                  </View>
                </View>
                <Text
                  variant="caption"
                  tone={item.unlocked ? 'brand' : 'muted'}
                  style={{ flexShrink: 0 }}
                >
                  {item.unlocked
                    ? t('engagement.consistency.milestoneUnlocked')
                    : t('engagement.consistency.milestoneRemaining', {
                        count: remaining,
                      })}
                </Text>
              </View>
              {!item.unlocked ? (
                <View
                  style={[styles.progressTrack, { backgroundColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(progress * 100)}%`,
                        backgroundColor: colors.warning,
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {allUnlocked && userId ? (
        <View
          style={[
            styles.personalCard,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: personalReached ? colors.primary : colors.border,
            },
          ]}
        >
          <View style={{ gap: 2 }}>
            <Text variant="bodyStrong">
              {t('engagement.consistency.personalGoalTitle')}
            </Text>
            <Text variant="caption" tone="muted">
              {personalReached
                ? t('engagement.consistency.personalGoalReached', {
                    count: effectiveGoal ?? PERSONAL_MILESTONE_MIN,
                  })
                : t('engagement.consistency.personalGoalHint')}
            </Text>
          </View>

          {effectiveGoal != null && !personalReached ? (
            <View style={{ gap: spacing[2] }}>
              <Text variant="caption" tone="secondary">
                {t('engagement.consistency.personalGoalProgress', {
                  current: bestDays,
                  target: effectiveGoal,
                })}
              </Text>
              <View
                style={[styles.progressTrack, { backgroundColor: colors.border }]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(personalProgress * 100)}%`,
                      backgroundColor: colors.warning,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.personalForm}>
            <CompactInput
              value={draft}
              onChangeText={(text) => {
                setDraft(text.replace(/[^\d]/g, ''));
                setInputError(false);
              }}
              keyboardType="number-pad"
              maxLength={3}
              placeholder={t('engagement.consistency.personalGoalPlaceholder')}
              accessibilityLabel={t('engagement.consistency.personalGoalTitle')}
            />
            <Button
              label={t('engagement.consistency.personalGoalSave')}
              onPress={() => void saveGoal()}
              loading={saving}
              disabled={saving || draft.trim().length === 0}
              fullWidth={false}
            />
          </View>
          {inputError ? (
            <Text variant="caption" tone="error">
              {t('engagement.consistency.personalGoalInvalid', {
                min: PERSONAL_MILESTONE_MIN,
              })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[2],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    flex: 1,
    minWidth: 0,
  },
  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  personalCard: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[3],
  },
  personalForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
});
