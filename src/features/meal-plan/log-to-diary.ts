import { getSupabase } from '@/lib/supabase/client';

export { scalePlannedMealNutrition } from './nutrition';

export class PlannedMealAlreadyLoggedError extends Error {
  constructor(message = 'This planned meal is already logged.') {
    super(message);
    this.name = 'PlannedMealAlreadyLoggedError';
  }
}

/**
 * Atomically create one food_entry from a planned meal via Postgres RPC.
 * Hard-blocks duplicates (DB lock + unique indexes + ALREADY_LOGGED).
 */
export async function logPlannedMealToDiary(input: {
  plannedMealId: string;
  actualServings: number;
}): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!(input.actualServings > 0)) {
    throw new Error('Servings must be greater than zero.');
  }

  const { data, error } = await supabase.rpc('log_planned_meal', {
    p_planned_meal_id: input.plannedMealId,
    p_actual_servings: input.actualServings,
  });

  if (error) {
    const message = error.message || 'Could not log planned meal.';
    if (/ALREADY_LOGGED/i.test(message) || error.code === '23505') {
      throw new PlannedMealAlreadyLoggedError();
    }
    throw new Error(message);
  }

  if (typeof data !== 'string' || !data) {
    throw new Error('Could not log planned meal.');
  }
  return data;
}
