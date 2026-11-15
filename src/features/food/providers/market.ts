import type { FoodMarket } from './types';

/**
 * Trackwise has no profile country field yet.
 * Fallback: map app language → default food market, English → US.
 */
export function marketFromLanguage(language?: string | null): FoodMarket {
  const raw = (language ?? 'en').trim().toLowerCase();
  const lc = raw.startsWith('zh') ? 'zh' : raw.slice(0, 2);

  switch (lc) {
    case 'vi':
      return { region: 'VN', language: 'vi' };
    case 'fi':
      return { region: 'FI', language: 'fi' };
    case 'sv':
      return { region: 'SE', language: 'sv' };
    case 'nb':
    case 'nn':
    case 'no':
      return { region: 'NO', language: 'nb' };
    case 'da':
      return { region: 'DK', language: 'da' };
    case 'is':
      return { region: 'IS', language: 'is' };
    case 'de':
      return { region: 'DE', language: 'de' };
    case 'fr':
      return { region: 'FR', language: 'fr' };
    case 'nl':
      return { region: 'NL', language: 'nl' };
    case 'it':
      return { region: 'IT', language: 'it' };
    case 'es':
      return { region: 'ES', language: 'es' };
    case 'pl':
      return { region: 'PL', language: 'pl' };
    case 'ko':
      return { region: 'KR', language: 'ko' };
    case 'ja':
      return { region: 'JP', language: 'ja' };
    case 'zh':
      return { region: 'CN', language: 'zh' };
    default:
      return { region: 'US', language: 'en' };
  }
}
