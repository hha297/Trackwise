import { describe, expect, it } from 'vitest';

import en from '@/i18n/locales/en.json';
import fi from '@/i18n/locales/fi.json';
import sv from '@/i18n/locales/sv.json';
import vi from '@/i18n/locales/vi.json';

import { COMPANION_CTA_HREFS, presentCompanionCard, presentMilestone } from './presentation';
import type { CompanionSuggestion, JourneyMilestone } from './types';

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const locales = {
  en: flatten(en as Record<string, unknown>),
  fi: flatten(fi as Record<string, unknown>),
  sv: flatten(sv as Record<string, unknown>),
  vi: flatten(vi as Record<string, unknown>),
};

describe('companion presentation (UI contract)', () => {
  it('maps every operational suggestion to localized copy and a real destination', () => {
    for (const [id, href] of Object.entries(COMPANION_CTA_HREFS)) {
      const suggestion: CompanionSuggestion = {
        id,
        category: 'general',
        priority: 1,
        dismissible: true,
        params: { grams: 35, consumed: 1800, target: 2000 },
        cta: { href, params: id.includes('food') || id === 'protein_remaining' ? { intent: 'log', date: '2026-11-16' } : undefined },
      };
      const presented = presentCompanionCard(suggestion);
      expect(presented.href).toBe(href);
      for (const table of Object.values(locales)) {
        expect(table[presented.titleKey], presented.titleKey).toBeTruthy();
        expect(table[presented.bodyKey], presented.bodyKey).toBeTruthy();
        expect(table[presented.ctaKey], presented.ctaKey).toBeTruthy();
        expect(table[presented.dismissKey]).toBeTruthy();
        expect(table[presented.a11yKey]).toBeTruthy();
      }
    }
  });

  it('localizes journey milestones including empty and category labels', () => {
    const row: JourneyMilestone = {
      id: 'first_workout',
      category: 'workout',
      achievedOn: '2026-11-01',
      stat: 1,
    };
    const presented = presentMilestone(row);
    for (const table of Object.values(locales)) {
      expect(table[presented.titleKey]).toBeTruthy();
      expect(table[presented.bodyKey]).toBeTruthy();
      expect(table[presented.categoryKey]).toBeTruthy();
      expect(table['companion.journey.empty']).toBeTruthy();
      expect(table['companion.journey.loadError']).toBeTruthy();
      expect(table['companion.comeback.title']).toBeTruthy();
    }
  });

  it('keeps CTA destinations stable for tests and navigation', () => {
    expect(COMPANION_CTA_HREFS.log_food).toBe('/food/add');
    expect(COMPANION_CTA_HREFS.scheduled_workout).toBe('/(tabs)/workout');
    expect(COMPANION_CTA_HREFS.overdue_workout).toBe('/workout/plan');
    expect(COMPANION_CTA_HREFS.missed_sessions).toBe('/workout/plan');
  });
});
