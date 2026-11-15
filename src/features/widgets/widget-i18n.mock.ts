import en from '@/i18n/locales/en.json';

function lookup(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

function t(key: string, opts?: { count?: number; value?: string }): string {
  const raw = lookup(en, key);
  if (typeof raw !== 'string') return key;
  return raw
    .replace(/\{\{count\}\}/g, String(opts?.count ?? ''))
    .replace(/\{\{value\}\}/g, opts?.value ?? '');
}

const i18n = { language: 'en', t };
export default i18n;
export { t };
