import Constants from 'expo-constants';

export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

type Extra = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

type ManifestExtraHost = {
  extra?: Extra & {
    expoClient?: {
      extra?: Extra;
    };
  };
};

function nonempty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asExtra(value: unknown): Extra {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as Extra;
}

function extraFromConfig(config: unknown): Extra {
  if (!config || typeof config !== 'object') {
    return {};
  }
  return asExtra((config as { extra?: unknown }).extra);
}

function extraFromNativeManifest(): Extra {
  try {
    const rn = require('react-native') as {
      NativeModules?: { ExponentConstants?: { manifest?: unknown } };
    };
    const raw = rn.NativeModules?.ExponentConstants?.manifest;
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    return extraFromConfig(parsed);
  } catch {
    return {};
  }
}

function extraSources(): Extra[] {
  const manifest2 = (Constants as { manifest2?: ManifestExtraHost | null }).manifest2;
  return [
    asExtra(Constants.expoConfig?.extra),
    extraFromConfig(manifest2?.extra?.expoClient),
    asExtra((Constants.manifest as ManifestExtraHost | null)?.extra),
    extraFromNativeManifest(),
  ];
}

function firstExtraValue(read: (extra: Extra) => unknown): string {
  for (const extra of extraSources()) {
    const value = nonempty(read(extra));
    if (value) {
      return value;
    }
  }
  return '';
}

export function getSupabaseEnv(): SupabaseEnv | null {
  // Skip empty Metro inlines so a development client can still use the APK extra.
  const url =
    nonempty(process.env.EXPO_PUBLIC_SUPABASE_URL) ||
    firstExtraValue((extra) => extra.supabaseUrl);

  const publishableKey =
    nonempty(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    nonempty(process.env.EXPO_PUBLIC_SUPABASE_KEY) ||
    firstExtraValue((extra) => extra.supabasePublishableKey);

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}
