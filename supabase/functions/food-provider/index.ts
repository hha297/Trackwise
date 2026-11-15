/**
 * Proxies FatSecret + USDA food search/barcode with server-only secrets.
 *
 * FatSecret traffic goes through the Oracle FastAPI proxy (IP-allowlisted host),
 * never FatSecret credentials in the mobile app.
 *
 * Secrets (Supabase Edge):
 *   FATSECRET_PROXY_URL      (default https://fatsecret-proxy.trackwise.one)
 *   FATSECRET_PROXY_SECRET   (same value as PROXY_SHARED_SECRET on the VM)
 *   USDA_API_KEY
 *
 * Deploy:
 *   npx supabase secrets set FATSECRET_PROXY_URL=https://fatsecret-proxy.trackwise.one FATSECRET_PROXY_SECRET=... USDA_API_KEY=...
 *   npx supabase functions deploy food-provider
 *
 * Account scopes: `basic` only (no barcode / localization / premier).
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Nutrition = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG?: number | null;
  sugarsG?: number | null;
  saturatedFatG?: number | null;
  sodiumMg?: number | null;
};

type NormalizedFood = {
  id: string;
  provider: 'fatsecret' | 'usda' | 'open_food_facts';
  providerFoodId: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  description: string | null;
  kind: 'generic' | 'branded' | 'prepared' | 'unknown';
  state: 'raw' | 'cooked' | 'dried' | 'frozen' | 'canned' | 'unknown';
  country: string | null;
  language: string | null;
  imageUrl: string | null;
  nutritionBasis: 'per100' | 'serving';
  basisUnit: 'g' | 'ml' | null;
  nutrition: Nutrition;
  servings: Array<{
    id: string | null;
    label: string;
    amount: number | null;
    unit: 'g' | 'ml' | 'serving' | null;
    grams: number | null;
    isDefault?: boolean;
  }>;
  completeness: 'complete' | 'partial' | 'insufficient';
  rawOrCookedHint: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization.' }, 401);

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      query?: string;
      barcode?: string;
      region?: string;
      language?: string;
      limit?: number;
    };

    const action = body.action ?? 'search';
    const region = (body.region ?? 'US').toUpperCase();
    const language = (body.language ?? 'en').toLowerCase();
    const providersCalled: string[] = [];
    const providerErrors: Record<string, string> = {};

    if (action === 'barcode') {
      const barcode = normalizeBarcode(body.barcode ?? '');
      if (!barcode) return json({ error: 'Invalid barcode.' }, 400);

      // FatSecret barcode requires `barcode` scope — usually unavailable on basic plans.
      providersCalled.push('fatsecret');
      providerErrors.fatsecret =
        'FatSecret barcode scope is not enabled on this account. Use Open Food Facts client lookup.';

      return json({
        food: null,
        providersCalled,
        providerErrors,
      });
    }

    const query = (body.query ?? '').trim();
    if (query.length < 2) return json({ error: 'Query too short.' }, 400);
    const limit = Math.min(Math.max(Number(body.limit ?? 20) || 20, 1), 40);

    const foods: NormalizedFood[] = [];

    // TEMP: USDA disabled — slow and was crowding out FatSecret during testing.
    // Re-enable by restoring the USDA search block below.
    // providersCalled.push('usda');
    // try {
    //   const usda = await searchUsda(query, limit);
    //   foods.push(...usda);
    // } catch (error) {
    //   providerErrors.usda = error instanceof Error ? error.message : 'USDA search failed.';
    // }

    // --- FatSecret ---
    providersCalled.push('fatsecret');
    try {
      const fs = await searchFatSecret(query, { region, language, limit });
      foods.push(...fs);
    } catch (error) {
      providerErrors.fatsecret =
        error instanceof Error ? error.message : 'FatSecret search failed.';
    }

    return json({
      foods,
      providersCalled,
      providerErrors,
      region,
      language,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return json({ error: message }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeBarcode(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits.padStart(13, '0');
  }
  return null;
}

function completeness(n: Nutrition) {
  const present = [n.calories, n.proteinG, n.carbsG, n.fatG].filter(
    (v) => v != null && Number.isFinite(v),
  ).length;
  if (present === 4) return 'complete' as const;
  if (present === 0) return 'insufficient' as const;
  return 'partial' as const;
}

function detectState(name: string): NormalizedFood['state'] {
  const q = name.toLowerCase();
  if (/\b(raw|uncooked|fresh)\b/.test(q)) return 'raw';
  if (/\b(cooked|grilled|roasted|fried|boiled|baked|smoked)\b/.test(q)) return 'cooked';
  if (/\b(dry|dried)\b/.test(q)) return 'dried';
  if (/\bfrozen\b/.test(q)) return 'frozen';
  if (/\bcanned\b/.test(q)) return 'canned';
  return 'unknown';
}

async function searchUsda(query: string, limit: number): Promise<NormalizedFood[]> {
  const apiKey = Deno.env.get('USDA_API_KEY');
  if (!apiKey) throw new Error('USDA_API_KEY is not configured on the server.');

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', String(Math.min(limit, 25)));
  url.searchParams.set('dataType', 'Foundation,SR Legacy');

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (response.status === 429) throw new Error('USDA rate limit reached. Try again shortly.');
  if (!response.ok) throw new Error(`USDA search failed (${response.status}).`);
  const json = (await response.json()) as {
    foods?: Array<{
      fdcId: number;
      description?: string;
      brandOwner?: string;
      brandName?: string;
      dataType?: string;
      servingSize?: number;
      servingSizeUnit?: string;
      householdServingFullText?: string;
      gtinUpc?: string;
      foodNutrients?: Array<{
        nutrientId?: number;
        unitName?: string;
        value?: number;
        amount?: number;
      }>;
    }>;
  };

  const out: NormalizedFood[] = [];
  for (const food of json.foods ?? []) {
    const mapped = mapUsda(food);
    if (mapped) out.push(mapped);
  }
  return out;
}

function mapUsda(food: {
  fdcId: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  gtinUpc?: string;
  foodNutrients?: Array<{
    nutrientId?: number;
    unitName?: string;
    value?: number;
    amount?: number;
  }>;
}): NormalizedFood | null {
  const name = food.description?.trim();
  if (!name) return null;
  const nutrients = food.foodNutrients ?? [];
  const pick = (ids: number[], unit: string) => {
    for (const n of nutrients) {
      if (!n.nutrientId || !ids.includes(n.nutrientId)) continue;
      if (n.unitName && n.unitName.toUpperCase() !== unit) continue;
      const value = n.value ?? n.amount;
      if (value != null && Number.isFinite(value)) return Number(value);
    }
    return null;
  };

  const nutrition: Nutrition = {
    calories: pick([1008, 2047], 'KCAL'),
    proteinG: pick([1003], 'G'),
    carbsG: pick([1005], 'G'),
    fatG: pick([1004], 'G'),
    fiberG: pick([1079], 'G'),
    sugarsG: pick([2000, 1063], 'G'),
    saturatedFatG: pick([1258], 'G'),
    sodiumMg: pick([1093], 'MG'),
  };
  const c = completeness(nutrition);
  if (c === 'insufficient') return null;

  const branded = (food.dataType ?? '').toLowerCase().includes('branded');
  const state = detectState(name);
  const servingUnit = food.servingSizeUnit?.toLowerCase();
  const servingGrams =
    food.servingSize != null && servingUnit === 'g' ? Number(food.servingSize) : null;

  return {
    id: `usda:${food.fdcId}`,
    provider: 'usda',
    providerFoodId: String(food.fdcId),
    barcode: food.gtinUpc?.trim() || null,
    name,
    brand: food.brandOwner?.trim() || food.brandName?.trim() || null,
    description: food.dataType ?? null,
    kind: branded ? 'branded' : 'generic',
    state,
    country: 'US',
    language: 'en',
    imageUrl: null,
    nutritionBasis: 'per100',
    basisUnit: 'g',
    nutrition,
    servings: [
      {
        id: 'usda-100g',
        label: '100 g',
        amount: 100,
        unit: 'g',
        grams: 100,
        isDefault: true,
      },
      ...(servingGrams
        ? [
            {
              id: 'usda-label',
              label: food.householdServingFullText?.trim() || `${servingGrams} g`,
              amount: servingGrams,
              unit: 'g' as const,
              grams: servingGrams,
              isDefault: false,
            },
          ]
        : []),
    ],
    completeness: c,
    rawOrCookedHint: state === 'unknown' ? null : state,
  };
}

const FATSECRET_PROXY_DEFAULT = 'https://fatsecret-proxy.trackwise.one';
const FATSECRET_ENRICH_LIMIT = 8;
const FATSECRET_PROXY_TIMEOUT_MS = 18_000;

async function callFatSecretProxy(
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const base = (Deno.env.get('FATSECRET_PROXY_URL') || FATSECRET_PROXY_DEFAULT).replace(
    /\/$/,
    '',
  );
  const secret = Deno.env.get('FATSECRET_PROXY_SECRET');
  if (!secret) {
    throw new Error('FATSECRET_PROXY_SECRET is not configured on the server.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FATSECRET_PROXY_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${base}/v1/fatsecret`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Proxy-Secret': secret,
      },
      body: JSON.stringify({ method, format: 'json', ...params }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('FatSecret proxy timed out.');
    }
    throw new Error('FatSecret proxy is unreachable.');
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('FatSecret proxy returned invalid JSON.');
  }

  if (response.status === 401) {
    throw new Error('FatSecret proxy authentication failed.');
  }
  if (response.status === 429) {
    throw new Error('FatSecret rate limit reached. Try again shortly.');
  }
  if (!response.ok) {
    const message =
      typeof json.error === 'string'
        ? json.error
        : (json.error as { message?: string } | undefined)?.message;
    throw new Error(message || `FatSecret proxy failed (${response.status}).`);
  }

  const upstreamErr = (json.error as { message?: string } | undefined)?.message;
  if (upstreamErr) throw new Error(upstreamErr);

  return json;
}

function extractFatSecretFoodList(json: Record<string, unknown>): Record<string, unknown>[] {
  const foodsSearch = json.foods_search as { results?: { food?: unknown } } | undefined;
  const raw =
    foodsSearch?.results?.food ??
    (json as { foods?: { food?: unknown } }).foods?.food ??
    (json as { food?: unknown }).food;
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') return [raw as Record<string, unknown>];
  return [];
}

async function getFatSecretFood(
  foodId: string,
  options: { region: string; language: string },
): Promise<NormalizedFood | null> {
  // Prefer classic food.get (basic scope). Fall back only if needed.
  let json: Record<string, unknown>;
  try {
    json = await callFatSecretProxy('food.get', { food_id: foodId });
  } catch {
    json = await callFatSecretProxy('food.get.v4', { food_id: foodId });
  }
  const food = (json.food as Record<string, unknown> | undefined) ?? json;
  return mapFatSecret(food, options);
}

async function searchFatSecret(
  query: string,
  options: { region: string; language: string; limit: number },
): Promise<NormalizedFood[]> {
  // localization scope unavailable — do not send region/language to FatSecret.
  let json: Record<string, unknown>;
  try {
    json = await callFatSecretProxy('foods.search', {
      search_expression: query,
      max_results: Math.min(options.limit, 20),
    });
  } catch (primaryError) {
    // Some accounts expose v4 search via server.api; try once.
    try {
      json = await callFatSecretProxy('foods.search.v4', {
        search_expression: query,
        max_results: Math.min(options.limit, 20),
      });
    } catch {
      throw primaryError instanceof Error
        ? primaryError
        : new Error('FatSecret search failed.');
    }
  }

  const list = extractFatSecretFoodList(json);
  const mapped: NormalizedFood[] = [];
  for (const item of list) {
    const food = mapFatSecret(item, options);
    if (food) mapped.push(food);
  }

  // TEMP: skip food.get enrichment while isolating FatSecret search latency.
  // Re-enable by setting TEMP_SKIP_FATSECRET_ENRICH = false.
  const TEMP_SKIP_FATSECRET_ENRICH = true;
  if (TEMP_SKIP_FATSECRET_ENRICH) return mapped;

  // Enrich top incomplete hits with food.get so servings / macros are usable.
  const enrichIds = mapped
    .filter((f) => f.completeness !== 'complete')
    .slice(0, FATSECRET_ENRICH_LIMIT)
    .map((f) => f.providerFoodId);

  if (enrichIds.length === 0) return mapped;

  const enriched = await Promise.all(
    enrichIds.map(async (id) => {
      try {
        return await getFatSecretFood(id, options);
      } catch {
        return null;
      }
    }),
  );

  const byId = new Map(
    enriched.filter((f): f is NormalizedFood => f != null).map((f) => [f.providerFoodId, f]),
  );

  return mapped.map((food) => byId.get(food.providerFoodId) ?? food);
}

function mapFatSecret(
  item: Record<string, unknown>,
  options: { region: string; language: string },
): NormalizedFood | null {
  const name = String(item.food_name ?? '').trim();
  if (!name) return null;
  const foodId = String(item.food_id ?? '');
  if (!foodId) return null;

  const foodType = String(item.food_type ?? '').toLowerCase();
  const brand = item.brand_name ? String(item.brand_name) : null;

  // Search v4 may include servings nested; nutrition often only on food.get.
  const servingsRaw = item.servings as { serving?: unknown } | undefined;
  const servingList = Array.isArray(servingsRaw?.serving)
    ? servingsRaw!.serving
    : servingsRaw?.serving
      ? [servingsRaw!.serving]
      : [];

  let nutrition: Nutrition = {
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };
  let basis: 'per100' | 'serving' = 'serving';
  let basisUnit: 'g' | 'ml' | null = null;
  const servings: NormalizedFood['servings'] = [];

  for (const s of servingList as Array<Record<string, unknown>>) {
    const metricServing = Number(s.metric_serving_amount);
    const metricUnit = String(s.metric_serving_unit ?? '').toLowerCase();
    const is100 =
      metricServing === 100 && (metricUnit === 'g' || metricUnit === 'ml');
    const calories = num(s.calories);
    const protein = num(s.protein);
    const carbs = num(s.carbohydrate);
    const fat = num(s.fat);
    servings.push({
      id: s.serving_id != null ? String(s.serving_id) : null,
      label: String(s.serving_description ?? 'serving'),
      amount: metricServing || num(s.number_of_units) || 1,
      unit: metricUnit === 'g' || metricUnit === 'ml' ? metricUnit : 'serving',
      grams: metricUnit === 'g' ? metricServing || null : null,
      isDefault: is100 || servings.length === 0,
    });
    if (is100 || nutrition.calories == null) {
      nutrition = {
        calories,
        proteinG: protein,
        carbsG: carbs,
        fatG: fat,
      };
      if (is100) {
        basis = 'per100';
        basisUnit = metricUnit as 'g' | 'ml';
      }
    }
  }

  // foods.search often puts macros only in food_description text.
  if (nutrition.calories == null && item.food_description) {
    const parsed = parseFatSecretDescription(String(item.food_description));
    if (parsed) {
      nutrition = parsed.nutrition;
      basis = parsed.basis;
      basisUnit = parsed.basisUnit;
      if (servings.length === 0 && parsed.basis === 'per100' && parsed.basisUnit) {
        servings.push({
          id: null,
          label: `100 ${parsed.basisUnit}`,
          amount: 100,
          unit: parsed.basisUnit,
          grams: parsed.basisUnit === 'g' ? 100 : null,
          isDefault: true,
        });
      }
    }
  }

  // Description-only search hits without nested nutrition are still useful as names,
  // but mark insufficient so ranking deprioritizes them until food.get enrichment.
  const c = completeness(nutrition);
  const state = detectState(name);

  return {
    id: `fatsecret:${foodId}`,
    provider: 'fatsecret',
    providerFoodId: foodId,
    barcode: null,
    name,
    brand,
    description: item.food_description ? String(item.food_description) : null,
    kind: foodType.includes('brand') || brand ? 'branded' : 'generic',
    state,
    country: options.region,
    language: options.language,
    imageUrl: null,
    nutritionBasis: basis,
    basisUnit,
    nutrition,
    servings:
      servings.length > 0
        ? servings
        : [
            {
              id: null,
              label: '1 serving',
              amount: 1,
              unit: 'serving',
              grams: null,
              isDefault: true,
            },
          ],
    completeness: c,
    rawOrCookedHint: state === 'unknown' ? null : state,
  };
}

function num(value: unknown) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseFatSecretDescription(description: string): {
  nutrition: Nutrition;
  basis: 'per100' | 'serving';
  basisUnit: 'g' | 'ml' | null;
} | null {
  const calories = description.match(/Calories:\s*([\d.]+)\s*kcal/i);
  const fat = description.match(/Fat:\s*([\d.]+)\s*g/i);
  const carbs = description.match(/Carbs:\s*([\d.]+)\s*g/i);
  const protein = description.match(/Protein:\s*([\d.]+)\s*g/i);
  if (!calories && !fat && !carbs && !protein) return null;

  const per100 = /per\s*100\s*(g|ml)/i.exec(description);
  return {
    nutrition: {
      calories: calories ? Number(calories[1]) : null,
      fatG: fat ? Number(fat[1]) : null,
      carbsG: carbs ? Number(carbs[1]) : null,
      proteinG: protein ? Number(protein[1]) : null,
    },
    basis: per100 ? 'per100' : 'serving',
    basisUnit: per100 ? (per100[1].toLowerCase() as 'g' | 'ml') : null,
  };
}
