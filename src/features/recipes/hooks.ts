import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';

import {
  createRecipe,
  deleteRecipe,
  fetchRecipe,
  fetchRecipes,
  updateRecipe,
} from './api';
import type { RecipeIngredientDraft } from './types';

export function useRecipes(search = '') {
  const { session } = useAuth();
  const userId = session?.user.id;
  const trimmed = search.trim().toLowerCase();

  return useQuery({
    queryKey: ['recipes', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchRecipes(userId!),
    select: (rows) =>
      trimmed
        ? rows.filter((row) => row.name.toLowerCase().includes(trimmed))
        : rows,
    staleTime: 30_000,
  });
}

export function useRecipe(recipeId: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['recipes', userId, recipeId],
    enabled: Boolean(userId) && Boolean(recipeId),
    queryFn: () => fetchRecipe(userId!, recipeId!),
    staleTime: 30_000,
  });
}

export function useRecipeMutations() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const invalidate = async (recipeId?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['recipes', userId] });
    if (recipeId) {
      await queryClient.invalidateQueries({ queryKey: ['recipes', userId, recipeId] });
    }
  };

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      description?: string | null;
      instructions?: string | null;
      servings: number;
      imageUrl?: string | null;
      ingredients: RecipeIngredientDraft[];
    }) => createRecipe({ userId: userId!, ...input }),
    onSuccess: async (id) => invalidate(id),
  });

  const update = useMutation({
    mutationFn: (input: {
      recipeId: string;
      name: string;
      description?: string | null;
      instructions?: string | null;
      servings: number;
      imageUrl?: string | null;
      ingredients: RecipeIngredientDraft[];
    }) => updateRecipe({ userId: userId!, ...input }),
    onSuccess: async (_data, variables) => invalidate(variables.recipeId),
  });

  const remove = useMutation({
    mutationFn: (recipeId: string) => deleteRecipe(userId!, recipeId),
    onSuccess: async (_data, recipeId) => {
      await invalidate(recipeId);
      await queryClient.invalidateQueries({ queryKey: ['planned-meals', userId] });
    },
  });

  return { create, update, remove };
}
