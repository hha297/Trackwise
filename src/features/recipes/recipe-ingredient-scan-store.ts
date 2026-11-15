import { create } from 'zustand';

import type { Food } from '@/features/food/types';
import type { RecipeIngredientDraft } from '@/features/recipes/types';

export type RecipeEditorDraftSnapshot = {
  sessionId: string;
  recipeId?: string;
  name: string;
  description: string;
  instructions: string;
  servingsText: string;
  ingredients: RecipeIngredientDraft[];
  search: string;
};

type RecipeIngredientScanState = {
  draft: RecipeEditorDraftSnapshot | null;
  pendingFood: { sessionId: string; food: Food } | null;
  beginScan: (draft: RecipeEditorDraftSnapshot) => void;
  setPendingFood: (sessionId: string, food: Food) => void;
  consumePendingFood: (sessionId: string) => Food | null;
  clearDraft: (sessionId?: string) => void;
};

/** Preserves RecipeEditor draft across Scan navigation; never logs to diary. */
export const useRecipeIngredientScanStore = create<RecipeIngredientScanState>((set, get) => ({
  draft: null,
  pendingFood: null,
  beginScan: (draft) => set({ draft, pendingFood: null }),
  setPendingFood: (sessionId, food) => set({ pendingFood: { sessionId, food } }),
  consumePendingFood: (sessionId) => {
    const pending = get().pendingFood;
    if (!pending || pending.sessionId !== sessionId) return null;
    set({ pendingFood: null });
    return pending.food;
  },
  clearDraft: (sessionId) => {
    const current = get().draft;
    if (sessionId && current && current.sessionId !== sessionId) return;
    set({ draft: null, pendingFood: null });
  },
}));
