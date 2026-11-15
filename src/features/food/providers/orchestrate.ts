import { expandFoodQuery, detectSearchIntent } from './aliases';
import { dedupeNormalizedFoods } from './dedupe';
import { searchViaFoodProviderEdge } from './edge-client';
import { marketFromLanguage } from './market';
import { searchOpenFoodFactsNormalized } from './open-food-facts-adapter';
import { rankNormalizedFoods } from './ranking';
import type { OrchestratedSearchResult, FoodProviderId } from './types';

/**
 * Unified food search:
 * 1) Expand query aliases (curated).
 * 2) Local catalog handled by caller/hooks.
 * 3) Edge: FatSecret (USDA currently disabled server-side).
 * 4) Open Food Facts client-side (stronger for Vietnamese / branded packs).
 * 5) Dedupe + rank.
 */
export async function orchestrateFoodSearch(input: {
  query: string;
  language?: string | null;
  signal?: AbortSignal;
  limit?: number;
}): Promise<OrchestratedSearchResult> {
  const market = marketFromLanguage(input.language);
  const intent = detectSearchIntent(input.query);
  const expandedQueries = expandFoodQuery(input.query, 3);
  const providersCalled: FoodProviderId[] = [];
  const providerErrors: Partial<Record<FoodProviderId, string>> = {};

  const remoteFoods = [];
  const isVietnamese = market.language.toLowerCase().startsWith('vi');

  // FatSecret via Edge — prefer English/alias expansion for VI queries.
  try {
    const edge = await searchViaFoodProviderEdge({
      query: (isVietnamese ? expandedQueries[0] : null) ?? input.query,
      market,
      signal: input.signal,
      limit: input.limit ?? 20,
    });
    for (const provider of edge.providersCalled) {
      if (provider === 'fatsecret' || provider === 'usda') {
        providersCalled.push(provider);
      }
    }
    for (const [key, message] of Object.entries(edge.providerErrors)) {
      if (key === 'fatsecret' || key === 'usda') {
        providerErrors[key] = message;
      }
    }
    remoteFoods.push(...edge.foods.filter((food) => food.provider !== 'usda'));
  } catch (error) {
    providerErrors.fatsecret =
      error instanceof Error ? error.message : 'Edge food search failed.';
  }

  // Open Food Facts — use the user's typed query (VI works here); one request to limit rate use.
  providersCalled.push('open_food_facts');
  try {
    const off = await searchOpenFoodFactsNormalized(input.query, {
      signal: input.signal,
      language: market.language,
      pageSize: 15,
    });
    remoteFoods.push(...off);
  } catch (error) {
    providerErrors.open_food_facts =
      error instanceof Error ? error.message : 'Open Food Facts search failed.';
  }

  const deduped = dedupeNormalizedFoods(remoteFoods);
  const ranked = rankNormalizedFoods(deduped, input.query, intent).slice(
    0,
    input.limit ?? 30,
  );

  return {
    foods: ranked,
    providersCalled: [...new Set(providersCalled)],
    providerErrors,
    expandedQueries,
    market,
  };
}
