import { detectFoodStateHint, detectSearchIntent } from './aliases';
import type { FoodSearchIntent, NormalizedFood } from './types';

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function scoreFood(food: NormalizedFood, query: string, intent: FoodSearchIntent): number {
  const q = fold(query);
  const name = fold(food.name);
  let score = 0;

  if (name === q) score += 120;
  else if (name.startsWith(q)) score += 80;
  else if (name.includes(q)) score += 50;

  if (intent === 'generic' && food.kind === 'generic') score += 35;
  if (intent === 'branded' && food.kind === 'branded') score += 40;
  if (intent === 'prepared' && food.kind === 'prepared') score += 40;
  if (intent === 'generic' && food.kind === 'branded') score -= 15;
  if (intent === 'prepared' && food.kind === 'generic') score -= 10;

  const queryState = detectFoodStateHint(query);
  const foodState = food.state !== 'unknown' ? food.state : detectFoodStateHint(food.name);
  if (queryState !== 'unknown' && foodState === queryState) score += 25;
  if (queryState === 'raw' && foodState === 'cooked') score -= 30;
  if (queryState === 'cooked' && foodState === 'raw') score -= 20;

  if (food.completeness === 'complete') score += 20;
  else if (food.completeness === 'partial') score += 8;
  else score -= 25;

  if (food.imageUrl) score += 3;
  if (food.provider === 'fatsecret') score += 6;
  if (food.provider === 'usda' && intent === 'generic') score += 10;
  if (food.provider === 'open_food_facts' && intent === 'branded') score += 8;
  // Vietnamese / non-English queries: OFF usually matches better than FatSecret basic.
  if (food.provider === 'open_food_facts' && food.language && food.language !== 'en') {
    score += 12;
  }

  return score;
}

export function rankNormalizedFoods(
  foods: NormalizedFood[],
  query: string,
  intent: FoodSearchIntent = detectSearchIntent(query),
): NormalizedFood[] {
  return [...foods].sort(
    (a, b) => scoreFood(b, query, intent) - scoreFood(a, query, intent),
  );
}
