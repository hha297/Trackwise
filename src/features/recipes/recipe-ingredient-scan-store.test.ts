import { beforeEach, describe, expect, it } from 'vitest';

import { useRecipeIngredientScanStore } from './recipe-ingredient-scan-store';
import type { Food } from '@/features/food/types';

const food = (id: string): Food => ({
  id,
  name: `Food ${id}`,
  brand: null,
  barcode: '1234567890123',
  serving_label: '100 g',
  serving_grams: 100,
  calories: 100,
  protein_g: 10,
  carbs_g: 10,
  fat_g: 1,
  source: 'open_food_facts',
  nutrition_basis: 'per100',
  basis_unit: 'g',
  basis_amount: 100,
});

describe('useRecipeIngredientScanStore', () => {
  beforeEach(() => {
    useRecipeIngredientScanStore.setState({ draft: null, pendingFood: null });
  });

  it('preserves draft across beginScan and ignores foreign session pending food', () => {
    useRecipeIngredientScanStore.getState().beginScan({
      sessionId: 's1',
      name: 'Soup',
      description: '',
      instructions: '',
      servingsText: '2',
      ingredients: [],
      search: '',
    });
    useRecipeIngredientScanStore.getState().setPendingFood('other', food('a'));
    expect(useRecipeIngredientScanStore.getState().consumePendingFood('s1')).toBeNull();
    expect(useRecipeIngredientScanStore.getState().draft?.name).toBe('Soup');
  });

  it('consumes pending food once for matching session', () => {
    useRecipeIngredientScanStore.getState().beginScan({
      sessionId: 's1',
      name: 'Soup',
      description: '',
      instructions: '',
      servingsText: '2',
      ingredients: [],
      search: '',
    });
    useRecipeIngredientScanStore.getState().setPendingFood('s1', food('b'));
    expect(useRecipeIngredientScanStore.getState().consumePendingFood('s1')?.id).toBe('b');
    expect(useRecipeIngredientScanStore.getState().consumePendingFood('s1')).toBeNull();
  });

  it('clearDraft only clears matching session', () => {
    useRecipeIngredientScanStore.getState().beginScan({
      sessionId: 's1',
      name: 'Soup',
      description: '',
      instructions: '',
      servingsText: '2',
      ingredients: [],
      search: '',
    });
    useRecipeIngredientScanStore.getState().clearDraft('s2');
    expect(useRecipeIngredientScanStore.getState().draft?.sessionId).toBe('s1');
    useRecipeIngredientScanStore.getState().clearDraft('s1');
    expect(useRecipeIngredientScanStore.getState().draft).toBeNull();
  });
});
