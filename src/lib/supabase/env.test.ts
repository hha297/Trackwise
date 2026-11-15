import { afterEach, describe, expect, it, vi } from 'vitest';
import Constants from 'expo-constants';

vi.mock('react-native', () => ({
  NativeModules: {},
}));

import { getSupabaseEnv } from './env';

type ConstantsMock = {
  expoConfig: { extra: Record<string, string> };
  manifest: { extra?: Record<string, string> } | null;
  manifest2: { extra?: { expoClient?: { extra?: Record<string, string> } } } | null;
};

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {},
    },
    manifest: null,
    manifest2: null,
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  const constants = Constants as ConstantsMock;
  constants.expoConfig.extra = {};
  constants.manifest = null;
  constants.manifest2 = null;
});

describe('getSupabaseEnv', () => {
  it('returns null when the public variables are missing', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', '');

    expect(getSupabaseEnv()).toBeNull();
  });

  it('returns the url and publishable key when both are set', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', '');

    expect(getSupabaseEnv()).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_test',
    });
  });

  it('accepts EXPO_PUBLIC_SUPABASE_KEY as an alias', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', 'sb_publishable_alias');

    expect(getSupabaseEnv()?.publishableKey).toBe('sb_publishable_alias');
  });

  it('falls back to app.config extra when process.env is empty', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', '');
    (Constants as { expoConfig: { extra: Record<string, string> } }).expoConfig.extra = {
      supabaseUrl: 'https://from-extra.supabase.co',
      supabasePublishableKey: 'sb_publishable_extra',
    };

    expect(getSupabaseEnv()).toEqual({
      url: 'https://from-extra.supabase.co',
      publishableKey: 'sb_publishable_extra',
    });
  });

  it('skips empty expoConfig extra and uses the embedded expoClient extra', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', '');
    (Constants as ConstantsMock).expoConfig.extra = {
      supabaseUrl: '',
      supabasePublishableKey: '',
    };
    (Constants as ConstantsMock).manifest2 = {
      extra: {
        expoClient: {
          extra: {
            supabaseUrl: 'https://from-manifest.supabase.co',
            supabasePublishableKey: 'sb_publishable_manifest',
          },
        },
      },
    };

    expect(getSupabaseEnv()).toEqual({
      url: 'https://from-manifest.supabase.co',
      publishableKey: 'sb_publishable_manifest',
    });
  });
});
