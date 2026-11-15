import { getSupabase } from '@/lib/supabase/client';

import type { NormalizedFood, FoodMarket } from './types';

type EdgeSearchResponse = {
  foods?: NormalizedFood[];
  providersCalled?: string[];
  providerErrors?: Record<string, string>;
  error?: string;
};

export async function searchViaFoodProviderEdge(input: {
  query: string;
  market: FoodMarket;
  signal?: AbortSignal;
  limit?: number;
}): Promise<{
  foods: NormalizedFood[];
  providersCalled: string[];
  providerErrors: Record<string, string>;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      foods: [],
      providersCalled: [],
      providerErrors: { edge: 'Supabase is not configured.' },
    };
  }

  const { data, error } = await supabase.functions.invoke('food-provider', {
    body: {
      action: 'search',
      query: input.query,
      region: input.market.region,
      language: input.market.language,
      limit: input.limit ?? 20,
    },
  });

  if (error) {
    return {
      foods: [],
      providersCalled: [],
      providerErrors: { edge: error.message || 'Food provider edge failed.' },
    };
  }

  const payload = (data ?? {}) as EdgeSearchResponse;
  if (payload.error) {
    return {
      foods: [],
      providersCalled: payload.providersCalled ?? [],
      providerErrors: { edge: payload.error },
    };
  }

  return {
    foods: Array.isArray(payload.foods) ? payload.foods : [],
    providersCalled: payload.providersCalled ?? [],
    providerErrors: payload.providerErrors ?? {},
  };
}

export async function barcodeViaFoodProviderEdge(input: {
  barcode: string;
  market: FoodMarket;
}): Promise<{
  food: NormalizedFood | null;
  providersCalled: string[];
  providerErrors: Record<string, string>;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      food: null,
      providersCalled: [],
      providerErrors: { edge: 'Supabase is not configured.' },
    };
  }

  const { data, error } = await supabase.functions.invoke('food-provider', {
    body: {
      action: 'barcode',
      barcode: input.barcode,
      region: input.market.region,
      language: input.market.language,
    },
  });

  if (error) {
    return {
      food: null,
      providersCalled: [],
      providerErrors: { edge: error.message || 'Food provider edge failed.' },
    };
  }

  const payload = (data ?? {}) as EdgeSearchResponse & { food?: NormalizedFood | null };
  return {
    food: payload.food ?? null,
    providersCalled: payload.providersCalled ?? [],
    providerErrors: payload.providerErrors ?? {},
  };
}
