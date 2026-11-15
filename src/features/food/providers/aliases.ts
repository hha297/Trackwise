import type { FoodSearchIntent } from './types';

/**
 * Curated aliases for high-value ingredients (not a full translation DB).
 * Keys are lowercase / accent-folded for lookup.
 */
const ALIAS_GROUPS: string[][] = [
  ['chicken breast', 'ức gà', 'uc ga', 'kanan rintafilee', 'kycklingbröst', 'kycklingbrost'],
  ['pork belly', 'thịt ba chỉ', 'thit ba chi', 'porsaan kylki', 'fläsksida', 'flask sida'],
  ['beef mince', 'minced beef', 'ground beef', 'thịt bò xay', 'thit bo xay', 'naudan jauheliha', 'nötfärs', 'notfars'],
  ['beef', 'thịt bò', 'thit bo', 'nauta', 'nötkött'],
  ['salmon', 'cá hồi', 'ca hoi', 'lohi', 'lax'],
  ['shrimp', 'prawn', 'tôm', 'tom', 'katkarapu', 'räka'],
  ['egg', 'eggs', 'trứng', 'trung', 'kananmuna', 'ägg', 'agg'],
  ['rice', 'gạo', 'gao', 'cơm', 'com', 'riisi', 'ris'],
  ['potato', 'khoai tây', 'khoai tay', 'peruna', 'potatis'],
  ['water spinach', 'rau muống', 'rau muong'],
  ['fish sauce', 'nước mắm', 'nuoc mam'],
  ['pho bo', 'phở bò', 'pho'],
  ['banh mi', 'bánh mì'],
  ['bun cha', 'bún chả'],
  ['rye bread', 'ruisleipä', 'ruisleipa', 'knäckebröd', 'knackebrod'],
  ['quark', 'rahka'],
  ['oat flakes', 'kaurahiutaleet', 'havregryn'],
  ['filmjolk', 'filmjölk'],
];

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Expand a user query into original + curated aliases (deduped, capped). */
export function expandFoodQuery(query: string, limit = 4): string[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const folded = fold(trimmed);
  const out: string[] = [trimmed];
  const seen = new Set([folded]);

  for (const group of ALIAS_GROUPS) {
    const hit = group.some((alias) => {
      const f = fold(alias);
      return f === folded || f.includes(folded) || folded.includes(f);
    });
    if (!hit) continue;
    for (const alias of group) {
      const f = fold(alias);
      if (seen.has(f)) continue;
      seen.add(f);
      out.push(alias);
      if (out.length >= limit) return out;
    }
  }

  return out;
}

export function detectSearchIntent(query: string): FoodSearchIntent {
  const q = fold(query);
  if (!q) return 'unknown';

  const prepared = [
    'pho',
    'phở',
    'banh mi',
    'bánh mì',
    'bun cha',
    'bún chả',
    'sushi',
    'lasagna',
    'lasagne',
    'pizza',
    'burger',
  ];
  if (prepared.some((p) => q.includes(fold(p)))) return 'prepared';

  const brandHints = [
    'vinamilk',
    'valio',
    'arla',
    'th true',
    'coca',
    'pepsi',
    'nestle',
    'milo',
  ];
  if (brandHints.some((b) => q.includes(b))) return 'branded';

  return 'generic';
}

export function detectFoodStateHint(name: string): 'raw' | 'cooked' | 'dried' | 'unknown' {
  const q = fold(name);
  if (/\b(raw|uncooked|fresh)\b/.test(q) || /\b(sống|tuoi|tươi)\b/.test(q)) return 'raw';
  if (/\b(cooked|grilled|roasted|fried|boiled|baked|smoked)\b/.test(q)) return 'cooked';
  if (/\b(dry|dried|uncooked dry)\b/.test(q)) return 'dried';
  return 'unknown';
}
