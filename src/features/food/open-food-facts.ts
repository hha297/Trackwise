export type NutritionBasis =
  | { kind: 'per100'; unit: 'g' | 'ml' }
  | { kind: 'serving'; label: string; amount: number | null; unit: 'g' | 'ml' | null };

export type TrackwiseFood = {
  name: string;
  brand: string | null;
  barcode: string;
  basis: NutritionBasis;
  serving: { label: string; amount: number; unit: 'g' | 'ml' } | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarsG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
  saltG: number | null;
  imageUrl: string | null;
  source: 'open_food_facts';
};

type OffProduct = {
  product_name?: string;
  brands?: string;
  code?: string;
  image_front_small_url?: string;
  image_front_url?: string;
  image_url?: string;
  nutriments?: Record<string, number | string | undefined>;
  serving_size?: string;
  nutrition_data_per?: string;
  product_quantity_unit?: string;
  quantity?: string;
  [key: string]: unknown;
};

type OffResponse = {
  status?: number;
  status_verbose?: string;
  code?: string;
  product?: OffProduct;
};

export type FoodLookupErrorKind =
  'network' | 'timeout' | 'rate_limit' | 'server' | 'invalid_response';

export class FoodLookupError extends Error {
  constructor(
    public readonly kind: FoodLookupErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'FoodLookupError';
  }
}

export type FoodLookupResult =
  { status: 'found'; food: TrackwiseFood } | { status: 'not_found'; barcode: string };

const OFF_NAME_LOCALES = ['en', 'vi', 'fi', 'sv', 'zh', 'ko', 'ja', 'fr', 'de'] as const;

const OFF_FIELDS = [
  'code',
  'product_name',
  ...OFF_NAME_LOCALES.map((lc) => `product_name_${lc}`),
  'brands',
  'image_front_small_url',
  'image_front_url',
  'image_url',
  'nutriments',
  'serving_size',
  'nutrition_data_per',
  'product_quantity_unit',
  'quantity',
].join(',');

function normalizeLanguageCode(language?: string | null) {
  const raw = (language ?? 'en').trim().toLowerCase();
  if (!raw) return 'en';
  if (raw.startsWith('zh')) return 'zh';
  return raw.slice(0, 2);
}

function localizedProductName(product: OffProduct, language?: string | null) {
  const lc = normalizeLanguageCode(language);
  const preferred = product[`product_name_${lc}`];
  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  for (const code of OFF_NAME_LOCALES) {
    const value = product[`product_name_${code}`];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return product.product_name?.trim() ?? '';
}

export function isSupportedProductBarcode(type: string, data: string) {
  if (!/^\d+$/.test(data)) return false;
  if (type === 'ean13') return data.length === 13;
  if (type === 'ean8') return data.length === 8;
  if (type === 'upc_a') return data.length === 12;
  if (type === 'upc_e') return data.length >= 6 && data.length <= 8;
  return type === 'itf14' && data.length === 14;
}

function numberOrNull(value: number | string | undefined) {
  if (value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseServing(value?: string) {
  if (!value) return { amount: null, unit: null } as const;
  const match = value.trim().match(/(\d+(?:[.,]\d+)?)\s*(ml|g)\b/i);
  if (!match) return { amount: null, unit: null } as const;
  return {
    amount: Number(match[1].replace(',', '.')),
    unit: match[2].toLowerCase() as 'g' | 'ml',
  };
}

function productUnit(product: OffProduct, servingUnit: 'g' | 'ml' | null): 'g' | 'ml' {
  const explicit = product.product_quantity_unit?.toLowerCase();
  if (explicit === 'ml' || explicit === 'cl' || explicit === 'l') return 'ml';
  if (servingUnit === 'ml' || /\b(?:ml|cl|l)\b/i.test(product.quantity ?? '')) return 'ml';
  return 'g';
}

function nutrient(nutriments: OffProduct['nutriments'], key: string, suffix: '100g' | 'serving') {
  return numberOrNull(nutriments?.[`${key}_${suffix}`]);
}

export function normalizeOpenFoodFactsProduct(
  product: OffProduct,
  requestedBarcode = '',
  language?: string | null,
): TrackwiseFood {
  const name = localizedProductName(product, language);

  const serving = parseServing(product.serving_size);
  const hasPer100 = ['energy-kcal', 'proteins', 'carbohydrates', 'fat'].some(
    (key) => nutrient(product.nutriments, key, '100g') !== null,
  );
  const hasServing = ['energy-kcal', 'proteins', 'carbohydrates', 'fat'].some(
    (key) => nutrient(product.nutriments, key, 'serving') !== null,
  );
  const useServing = !hasPer100 && hasServing;
  const suffix = useServing ? 'serving' : '100g';
  const unit = productUnit(product, serving.unit);

  return {
    name,
    brand: product.brands?.trim() || null,
    barcode: product.code?.trim() || requestedBarcode,
    basis: useServing
      ? {
          kind: 'serving',
          label: product.serving_size?.trim() || '1 serving',
          amount: serving.amount,
          unit: serving.unit,
        }
      : { kind: 'per100', unit },
    serving:
      serving.amount && serving.unit
        ? { label: product.serving_size!.trim(), amount: serving.amount, unit: serving.unit }
        : null,
    calories: nutrient(product.nutriments, 'energy-kcal', suffix),
    proteinG: nutrient(product.nutriments, 'proteins', suffix),
    carbsG: nutrient(product.nutriments, 'carbohydrates', suffix),
    fatG: nutrient(product.nutriments, 'fat', suffix),
    fiberG: nutrient(product.nutriments, 'fiber', suffix),
    sugarsG: nutrient(product.nutriments, 'sugars', suffix),
    saturatedFatG: nutrient(product.nutriments, 'saturated-fat', suffix),
    sodiumMg: nutrient(product.nutriments, 'sodium', suffix),
    saltG: nutrient(product.nutriments, 'salt', suffix),
    imageUrl: product.image_front_small_url || product.image_front_url || product.image_url || null,
    source: 'open_food_facts',
  };
}

const OFF_USER_AGENT = 'Trackwise/1.0 (mobile food search)';

async function fetchOpenFoodFactsJsonOnce(
  url: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 12_000;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': OFF_USER_AGENT },
      });
    } catch (error) {
      if (timedOut) throw new FoodLookupError('timeout', 'Food search timed out.', undefined);
      if (options.signal?.aborted) throw error;
      throw new FoodLookupError('network', 'Could not reach the food database.');
    }

    if (response.status === 429) {
      throw new FoodLookupError('rate_limit', 'Too many food searches. Wait a moment.', 429);
    }
    if (response.status >= 500) {
      throw new FoodLookupError('server', 'Food database is busy. Try again.', response.status);
    }
    if (!response.ok) {
      throw new FoodLookupError('invalid_response', 'Food search returned an unexpected response.', response.status);
    }

    try {
      return await response.json();
    } catch {
      throw new FoodLookupError('invalid_response', 'Food search returned an unexpected response.');
    }
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

async function fetchOpenFoodFactsJson(
  url: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<unknown> {
  try {
    return await fetchOpenFoodFactsJsonOnce(url, options);
  } catch (error) {
    // One quiet retry for transient OFF outages / rate spikes.
    if (!(error instanceof FoodLookupError)) throw error;
    if (error.kind !== 'server' && error.kind !== 'timeout' && error.kind !== 'rate_limit') {
      throw error;
    }
    if (options.signal?.aborted) throw error;
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (options.signal?.aborted) throw error;
    return fetchOpenFoodFactsJsonOnce(url, options);
  }
}

export async function fetchOpenFoodFactsByBarcode(
  barcode: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<FoodLookupResult> {
  const json = (await fetchOpenFoodFactsJson(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(OFF_FIELDS)}`,
    options,
  )) as OffResponse;

  if (json.status === 0 || !json.product) return { status: 'not_found', barcode };
  if (json.status !== 1) {
    throw new FoodLookupError('invalid_response', 'Open Food Facts returned an unknown status.');
  }
  return {
    status: 'found',
    food: normalizeOpenFoodFactsProduct(json.product, barcode),
  };
}

type OffSearchResponse = {
  products?: OffProduct[];
  count?: number;
};

/** Text Open Food Facts by product name/brand (used when the local foods catalog is sparse). */
export async function searchOpenFoodFactsProducts(
  term: string,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    pageSize?: number;
    language?: string | null;
  } = {},
): Promise<TrackwiseFood[]> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const language = normalizeLanguageCode(options.language);
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', trimmed);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', String(options.pageSize ?? 24));
  url.searchParams.set('lc', language);
  url.searchParams.set('cc', language);
  url.searchParams.set('fields', OFF_FIELDS);

  const json = (await fetchOpenFoodFactsJson(url.toString(), options)) as OffSearchResponse;
  const products = Array.isArray(json.products) ? json.products : [];

  return products
    .map((product) => normalizeOpenFoodFactsProduct(product, '', language))
    .filter((food) => food.name.trim().length > 0);
}

/** Stable client id for OFF search hits that are not yet in `public.foods`. */
export function openFoodFactsSearchId(food: Pick<TrackwiseFood, 'barcode' | 'name'>) {
  const key = food.barcode?.trim() || food.name.trim().toLowerCase();
  return `off:${key}`;
}

export function isOpenFoodFactsSearchId(id: string) {
  return id.startsWith('off:');
}
