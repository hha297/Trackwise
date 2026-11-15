import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchOpenFoodFactsByBarcode,
  FoodLookupError,
  isOpenFoodFactsSearchId,
  isSupportedProductBarcode,
  normalizeOpenFoodFactsProduct,
  openFoodFactsSearchId,
  searchOpenFoodFactsProducts,
} from './open-food-facts';

afterEach(() => vi.unstubAllGlobals());

describe('normalizeOpenFoodFactsProduct', () => {
  it('prefers a consistent per-100 basis and preserves missing nutrients', () => {
    const food = normalizeOpenFoodFactsProduct(
      {
        product_name: 'Greek Yogurt',
        brands: 'Example',
        code: '00123',
        serving_size: '150 g',
        nutriments: {
          'energy-kcal_100g': 80,
          proteins_100g: 10,
          carbohydrates_100g: 5,
        },
      },
      '00123',
    );
    expect(food).toMatchObject({
      barcode: '00123',
      basis: { kind: 'per100', unit: 'g' },
      calories: 80,
      proteinG: 10,
      carbsG: 5,
      fatG: null,
    });
  });

  it('uses a serving basis only when per-100 values are unavailable', () => {
    const food = normalizeOpenFoodFactsProduct({
      product_name: 'Snack',
      serving_size: '30 g',
      nutriments: { 'energy-kcal_serving': 120, proteins_serving: 3 },
    });
    expect(food?.basis).toEqual({ kind: 'serving', label: '30 g', amount: 30, unit: 'g' });
    expect(food?.fatG).toBeNull();
  });

  it('keeps a found product with incomplete identity and nutrition editable', () => {
    const food = normalizeOpenFoodFactsProduct({ code: '123' }, '123');
    expect(food).toMatchObject({ name: '', imageUrl: null, calories: null, fatG: null });
  });
});

describe('barcode validation', () => {
  it('keeps leading zeroes and rejects non-product payloads', () => {
    expect(isSupportedProductBarcode('ean13', '0123456789012')).toBe(true);
    expect(isSupportedProductBarcode('qr', 'https://example.com')).toBe(false);
    expect(isSupportedProductBarcode('code128', 'ABC-123')).toBe(false);
  });
});

describe('fetchOpenFoodFactsByBarcode', () => {
  it('distinguishes not found from errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 0 }), { status: 200 })),
    );
    await expect(fetchOpenFoodFactsByBarcode('00123')).resolves.toEqual({
      status: 'not_found',
      barcode: '00123',
    });
  });

  it('classifies rate limiting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(fetchOpenFoodFactsByBarcode('123')).rejects.toMatchObject<
      Partial<FoodLookupError>
    >({ kind: 'rate_limit', status: 429 });
  });

  it('classifies server errors separately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(fetchOpenFoodFactsByBarcode('123')).rejects.toMatchObject<
      Partial<FoodLookupError>
    >({ kind: 'server', status: 503 });
  });

  it('classifies a request timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    );
    await expect(fetchOpenFoodFactsByBarcode('123', { timeoutMs: 1 })).rejects.toMatchObject<
      Partial<FoodLookupError>
    >({ kind: 'timeout' });
  });
});

describe('searchOpenFoodFactsProducts', () => {
  it('returns normalized named products and skips blank names', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            products: [
              {
                product_name: 'Apple',
                brands: 'Fresh',
                code: '123',
                nutriments: {
                  'energy-kcal_100g': 52,
                  proteins_100g: 0.3,
                  carbohydrates_100g: 14,
                  fat_100g: 0.2,
                },
              },
              { code: '999', nutriments: { 'energy-kcal_100g': 10 } },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(searchOpenFoodFactsProducts('apple')).resolves.toEqual([
      expect.objectContaining({ name: 'Apple', barcode: '123', calories: 52 }),
    ]);
  });

  it('returns an empty list for short terms without calling the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchOpenFoodFactsProducts('a')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('openFoodFactsSearchId', () => {
  it('marks external search ids', () => {
    const id = openFoodFactsSearchId({ barcode: '00123', name: 'Apple' });
    expect(id).toBe('off:00123');
    expect(isOpenFoodFactsSearchId(id)).toBe(true);
    expect(isOpenFoodFactsSearchId('uuid-like')).toBe(false);
  });
});
