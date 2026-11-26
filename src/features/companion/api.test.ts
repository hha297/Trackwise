/* eslint-disable import/first -- vi.mock must load before the module under test */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ from: fromMock }),
}));

import { deleteDailyOverride, fetchDailyOverride, upsertDailyOverride } from './api';

function chain(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn(self);
  api.eq = vi.fn(self);
  api.maybeSingle = vi.fn(async () => result);
  api.single = vi.fn(async () => result);
  api.upsert = vi.fn(self);
  api.delete = vi.fn(self);
  api.order = vi.fn(self);
  return api;
}

describe('daily nutrition override api', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('fetches only the signed-in user\'s row for that diary date', async () => {
    const api = chain({
      data: { override_date: '2026-11-16', calories: 2200 },
      error: null,
    });
    fromMock.mockReturnValue(api);
    const row = await fetchDailyOverride('user-1', '2026-11-16');
    expect(fromMock).toHaveBeenCalledWith('daily_nutrition_overrides');
    expect(api.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(api.eq).toHaveBeenCalledWith('override_date', '2026-11-16');
    expect(row).toEqual({ overrideDate: '2026-11-16', calories: 2200 });
  });

  it('rejects invalid calories before writing', async () => {
    await expect(
      upsertDailyOverride({
        userId: 'user-1',
        dateKey: '2026-11-16',
        originalCalories: 2000,
        calories: 100,
      }),
    ).rejects.toThrow(/INVALID_OVERRIDE/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('treats a missing table as no override instead of throwing', async () => {
    const api = chain({
      data: null,
      error: {
        code: 'PGRST205',
        message: "Could not find the table 'public.daily_nutrition_overrides' in the schema cache",
      },
    });
    fromMock.mockReturnValue(api);
    await expect(fetchDailyOverride('user-1', '2026-11-16')).resolves.toBeNull();
  });

  it('upserts with user ownership and restores by deleting the day row', async () => {
    const upsertApi = chain({
      data: { override_date: '2026-11-16', calories: 2200 },
      error: null,
    });
    fromMock.mockReturnValue(upsertApi);
    await upsertDailyOverride({
      userId: 'user-1',
      dateKey: '2026-11-16',
      originalCalories: 2000,
      calories: 2200,
    });
    expect(upsertApi.upsert).toHaveBeenCalled();

    const deleteApi = chain({ data: null, error: null });
    fromMock.mockReturnValue(deleteApi);
    await deleteDailyOverride('user-1', '2026-11-16');
    expect(deleteApi.delete).toHaveBeenCalled();
    expect(deleteApi.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(deleteApi.eq).toHaveBeenCalledWith('override_date', '2026-11-16');
  });
});
