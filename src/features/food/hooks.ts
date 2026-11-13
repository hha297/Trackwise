import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { scaleNutrition, sumMacros, type MacroTotals } from '@/features/diary/balance';
import { getSupabase } from '@/lib/supabase/client';

import { fetchFoodEntries } from './api';
import type { Food, FoodEntry, MealType } from './types';

export type { Food, FoodEntry, MealType };

export function useFoodEntries(dateKey: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['food-entries', userId, dateKey],
    enabled: Boolean(userId),
    queryFn: () => fetchFoodEntries(userId!, dateKey),
    staleTime: 30_000,
  });
}

export function useDayFoodTotals(dateKey: string) {
  const query = useFoodEntries(dateKey);
  const totals: MacroTotals = sumMacros(
    (query.data ?? []).map((entry) => ({
      calories: entry.calories,
      proteinG: entry.protein_g,
      carbsG: entry.carbs_g,
      fatG: entry.fat_g,
    })),
  );
  return { ...query, totals };
}

export function useSearchFoods(term: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const trimmed = term.trim();

  return useQuery({
    queryKey: ['foods', 'search', userId, trimmed],
    enabled: Boolean(userId) && trimmed.length >= 2,
    queryFn: async (): Promise<Food[]> => {
      const supabase = getSupabase();
      if (!supabase || !userId) return [];
      const { data, error } = await supabase
        .from('foods')
        .select(
          'id, name, brand, barcode, serving_label, serving_grams, calories, protein_g, carbs_g, fat_g, source, image_url',
        )
        .or(`name.ilike.%${trimmed}%,brand.ilike.%${trimmed}%`)
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecentFoods() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['foods', 'recent', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<FoodEntry[]> => {
      const supabase = getSupabase();
      if (!supabase || !userId) return [];

      const withJoin =
        'id, logged_on, meal_type, quantity, food_name, brand, serving_label, calories, protein_g, carbs_g, fat_g, amount, amount_unit, image_url, fiber_g, sugars_g, saturated_fat_g, sodium_mg, food:foods ( image_url )';
      const basic =
        'id, logged_on, meal_type, quantity, food_name, brand, serving_label, calories, protein_g, carbs_g, fat_g, amount, amount_unit, image_url, fiber_g, sugars_g, saturated_fat_g, sodium_mg';

      for (const columns of [withJoin, basic]) {
        const { data, error } = await supabase
          .from('food_entries')
          .select(columns)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) continue;
        return (
          (data ?? []) as unknown as (FoodEntry & {
            food?: { image_url?: string | null } | null;
          })[]
        ).map((row) => {
          const { food, ...entry } = row;
          return {
            ...entry,
            image_url: entry.image_url ?? food?.image_url ?? null,
          };
        });
      }
      return [];
    },
  });
}

type LogFoodInput = {
  clientRequestId?: string;
  amount?: number;
  amountUnit?: 'g' | 'ml' | 'serving';
  nutritionBasis?: 'per100' | 'serving';
  basisAmount?: number;
  basisUnit?: 'g' | 'ml' | 'serving';
  nutritionUserEdited?: boolean;
  dateKey: string;
  mealType: MealType;
  quantity: number;
  food: {
    id?: string | null;
    name: string;
    brand?: string | null;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    imageUrl?: string | null;
    fiberG?: number | null;
    sugarsG?: number | null;
    saturatedFatG?: number | null;
    sodiumMg?: number | null;
  };
};

export function useLogFoodEntry() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogFoodInput) => {
      const supabase = getSupabase();
      const userId = session?.user.id;
      if (!supabase || !userId) throw new Error('Sign in to log food.');

      const scaled = scaleNutrition(
        {
          calories: input.food.calories,
          proteinG: input.food.proteinG,
          carbsG: input.food.carbsG,
          fatG: input.food.fatG,
        },
        input.quantity,
      );
      const scaleOptional = (value: number | null | undefined) =>
        value == null ? null : value * input.quantity;

      const row = {
        user_id: userId,
        food_id: input.food.id ?? null,
        logged_on: input.dateKey,
        meal_type: input.mealType,
        quantity: input.quantity,
        food_name: input.food.name,
        brand: input.food.brand ?? null,
        serving_label: input.food.servingLabel,
        calories: scaled.calories,
        protein_g: scaled.proteinG,
        carbs_g: scaled.carbsG,
        fat_g: scaled.fatG,
        client_request_id: input.clientRequestId ?? null,
        amount: input.amount ?? null,
        amount_unit: input.amountUnit ?? null,
        nutrition_basis: input.nutritionBasis ?? null,
        basis_amount: input.basisAmount ?? null,
        basis_unit: input.basisUnit ?? null,
        nutrition_user_edited: input.nutritionUserEdited ?? false,
        image_url: input.food.imageUrl ?? null,
        fiber_g: scaleOptional(input.food.fiberG),
        sugars_g: scaleOptional(input.food.sugarsG),
        saturated_fat_g: scaleOptional(input.food.saturatedFatG),
        sodium_mg: scaleOptional(input.food.sodiumMg),
      };
      const { error } = input.clientRequestId
        ? await supabase
            .from('food_entries')
            .upsert(row, { onConflict: 'user_id,client_request_id', ignoreDuplicates: true })
        : await supabase.from('food_entries').insert(row);
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['food-entries', session?.user.id, variables.dateKey],
      });
      await queryClient.invalidateQueries({
        queryKey: ['food-entries', 'range', session?.user.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ['food-entries', 'logged-days', session?.user.id],
      });
      await queryClient.invalidateQueries({ queryKey: ['foods', 'recent', session?.user.id] });
    },
  });
}

export function useUpdateFoodEntryAmount() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      dateKey: string;
      amount: number;
      amountUnit: 'g' | 'ml' | 'serving';
      servingLabel: string;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      fiberG?: number | null;
      sugarsG?: number | null;
      saturatedFatG?: number | null;
      sodiumMg?: number | null;
    }) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase
        .from('food_entries')
        .update({
          amount: input.amount,
          amount_unit: input.amountUnit,
          serving_label: input.servingLabel,
          calories: input.calories,
          protein_g: input.proteinG,
          carbs_g: input.carbsG,
          fat_g: input.fatG,
          fiber_g: input.fiberG ?? null,
          sugars_g: input.sugarsG ?? null,
          saturated_fat_g: input.saturatedFatG ?? null,
          sodium_mg: input.sodiumMg ?? null,
          quantity: 1,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['food-entries', session?.user.id, variables.dateKey],
      });
      await queryClient.invalidateQueries({
        queryKey: ['food-entries', 'range', session?.user.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ['food-entries', 'logged-days', session?.user.id],
      });
      await queryClient.invalidateQueries({ queryKey: ['foods', 'recent', session?.user.id] });
    },
  });
}

export function useDeleteFoodEntry() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; dateKey: string }) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('food_entries').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['food-entries', session?.user.id, variables.dateKey],
      });
      await queryClient.invalidateQueries({
        queryKey: ['food-entries', 'range', session?.user.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ['food-entries', 'logged-days', session?.user.id],
      });
    },
  });
}

export function useCreateManualFood() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      brand?: string;
      servingLabel: string;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      barcode?: string;
      source?: 'manual' | 'open_food_facts';
      imageUrl?: string;
      servingGrams?: number;
      nutritionBasis?: 'per100' | 'serving';
      basisUnit?: 'g' | 'ml' | 'serving';
      basisAmount?: number;
      nutritionUserEdited?: boolean;
    }) => {
      const supabase = getSupabase();
      const userId = session?.user.id;
      if (!supabase || !userId) throw new Error('Sign in required.');
      if (input.barcode) {
        const { data: existing, error: existingError } = await supabase
          .from('foods')
          .select(
            'id, name, brand, barcode, serving_label, serving_grams, calories, protein_g, carbs_g, fat_g, source, image_url',
          )
          .eq('user_id', userId)
          .eq('barcode', input.barcode)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing) return existing as Food;
      }
      const { data, error } = await supabase
        .from('foods')
        .insert({
          user_id: userId,
          name: input.name,
          brand: input.brand ?? null,
          barcode: input.barcode ?? null,
          serving_label: input.servingLabel,
          serving_grams: input.servingGrams ?? null,
          calories: input.calories,
          protein_g: input.proteinG,
          carbs_g: input.carbsG,
          fat_g: input.fatG,
          source: input.source ?? 'manual',
          image_url: input.imageUrl ?? null,
          nutrition_basis: input.nutritionBasis ?? null,
          basis_unit: input.basisUnit ?? null,
          basis_amount: input.basisAmount ?? null,
          nutrition_user_edited: input.nutritionUserEdited ?? false,
        })
        .select(
          'id, name, brand, barcode, serving_label, serving_grams, calories, protein_g, carbs_g, fat_g, source, image_url',
        )
        .single();
      if (error) throw error;
      return data as Food;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['foods'] });
    },
  });
}
