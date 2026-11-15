import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  getNotificationPermission,
  loadReminderPreferences,
  reconcileReminders,
  updateReminderPreferences,
} from './service';
import type { ReminderPreferences } from './types';

const PREFS_KEY = ['reminder-preferences'] as const;
const PERM_KEY = ['notification-permission'] as const;

export function useReminderPreferences() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const saveSeq = useRef(0);

  const prefsQuery = useQuery({
    queryKey: PREFS_KEY,
    queryFn: loadReminderPreferences,
  });
  const permissionQuery = useQuery({
    queryKey: PERM_KEY,
    queryFn: getNotificationPermission,
  });

  useEffect(() => {
    const onChange = (state: string) => {
      if (state !== 'active') return;
      void reconcileReminders().then((result) => {
        queryClient.setQueryData(PREFS_KEY, result.prefs);
        queryClient.setQueryData(PERM_KEY, result.permission);
        if (result.permission.canNotify) setPermissionBlocked(false);
      });
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [queryClient]);

  useEffect(() => {
    if (permissionQuery.data?.canNotify) setPermissionBlocked(false);
  }, [permissionQuery.data?.canNotify]);

  const refresh = useCallback(async () => {
    setError(null);
    await Promise.all([prefsQuery.refetch(), permissionQuery.refetch()]);
  }, [prefsQuery, permissionQuery]);

  const save = useCallback(
    async (next: ReminderPreferences) => {
      const seq = ++saveSeq.current;
      queryClient.setQueryData(PREFS_KEY, next);
      setError(null);
      try {
        const result = await updateReminderPreferences(next);
        if (seq !== saveSeq.current) return result;
        queryClient.setQueryData(PREFS_KEY, result.prefs);
        queryClient.setQueryData(PERM_KEY, result.permission);
        setPermissionBlocked(result.permissionBlocked);
        return result;
      } catch (err) {
        if (seq === saveSeq.current) {
          setError(err instanceof Error ? err.message : 'save_failed');
          await prefsQuery.refetch();
        }
        throw err;
      }
    },
    [queryClient, prefsQuery],
  );

  /** Applies updater against the latest cached prefs (safe for rapid toggles). */
  const patch = useCallback(
    (updater: (current: ReminderPreferences) => ReminderPreferences) => {
      const current =
        queryClient.getQueryData<ReminderPreferences>(PREFS_KEY) ?? prefsQuery.data ?? null;
      if (!current) return;
      void save(updater(current));
    },
    [queryClient, prefsQuery.data, save],
  );

  const permission = permissionQuery.data ?? null;
  const showPermissionBlocked = permissionBlocked && !permission?.canNotify;

  return {
    prefs: prefsQuery.data ?? null,
    permission,
    loading: prefsQuery.isLoading || permissionQuery.isLoading,
    error: error ?? (prefsQuery.error instanceof Error ? prefsQuery.error.message : null),
    permissionBlocked: showPermissionBlocked,
    refresh,
    save,
    patch,
  };
}
