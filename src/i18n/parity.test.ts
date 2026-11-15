import { describe, expect, it } from 'vitest';

import en from './locales/en.json';
import fi from './locales/fi.json';
import sv from './locales/sv.json';
import vi from './locales/vi.json';

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

describe('i18n locale parity', () => {
  const fen = flatten(en as Record<string, unknown>);
  const locales = {
    vi: flatten(vi as Record<string, unknown>),
    sv: flatten(sv as Record<string, unknown>),
    fi: flatten(fi as Record<string, unknown>),
  };
  const enKeys = Object.keys(fen);

  it('has matching keys in every supported locale', () => {
    for (const [lng, other] of Object.entries(locales)) {
      const missing = enKeys.filter((k) => !(k in other));
      const extra = Object.keys(other).filter((k) => !(k in fen));
      expect(missing, `${lng} missing keys`).toEqual([]);
      expect(extra, `${lng} extra keys`).toEqual([]);
    }
  });

  it('includes food add and scan namespaces used by critical flows', () => {
    expect(fen['food.add.title']).toBeTruthy();
    expect(fen['food.image.add']).toBeTruthy();
    expect(fen['scan.saveLog']).toBeTruthy();
    expect(fen['goalsEdit.save']).toBeTruthy();
  });
});
