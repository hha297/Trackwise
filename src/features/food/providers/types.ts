export type FoodProviderId = 'local' | 'fatsecret' | 'usda' | 'open_food_facts';

export type FoodKind = 'generic' | 'branded' | 'prepared' | 'unknown';

export type FoodState =
  | 'raw'
  | 'cooked'
  | 'dried'
  | 'frozen'
  | 'canned'
  | 'unknown';

export type NutritionCompleteness = 'complete' | 'partial' | 'insufficient';

export type NutritionBasisKind = 'per100' | 'serving';

export type NormalizedServing = {
  id: string | null;
  label: string;
  amount: number | null;
  unit: 'g' | 'ml' | 'serving' | null;
  grams: number | null;
  isDefault?: boolean;
};

export type NormalizedNutrition = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG?: number | null;
  sugarsG?: number | null;
  saturatedFatG?: number | null;
  sodiumMg?: number | null;
};

export type NormalizedFood = {
  /** Stable client/provider composite id, e.g. `usda:171477`. */
  id: string;
  provider: FoodProviderId;
  providerFoodId: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  description: string | null;
  kind: FoodKind;
  state: FoodState;
  country: string | null;
  language: string | null;
  imageUrl: string | null;
  nutritionBasis: NutritionBasisKind;
  basisUnit: 'g' | 'ml' | null;
  nutrition: NormalizedNutrition;
  servings: NormalizedServing[];
  completeness: NutritionCompleteness;
  rawOrCookedHint: string | null;
};

export type FoodSearchIntent = 'generic' | 'branded' | 'prepared' | 'barcode' | 'unknown';

export type FoodMarket = {
  /** ISO 3166-1 alpha-2 when known. */
  region: string;
  /** BCP-47 / ISO 639-1 language code. */
  language: string;
};

export type ProviderSearchRequest = {
  query: string;
  market: FoodMarket;
  intent: FoodSearchIntent;
  signal?: AbortSignal;
  limit?: number;
};

export type ProviderSearchResult = {
  foods: NormalizedFood[];
  provider: FoodProviderId;
  error?: string | null;
};

export type OrchestratedSearchResult = {
  foods: NormalizedFood[];
  providersCalled: FoodProviderId[];
  providerErrors: Partial<Record<FoodProviderId, string>>;
  expandedQueries: string[];
  market: FoodMarket;
};
