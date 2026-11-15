/**
 * Public site constants — edit here instead of Vercel env vars.
 * Safe to ship in the client bundle (no secrets).
 */

export const SITE_NAME = 'Trackwise';
export const SITE_LEGAL_NAME = 'Trackwise';
export const SITE_DOMAIN = 'trackwise.one';
export const SITE_URL = 'https://trackwise.one';
export const SITE_TAGLINE = 'Make every step count.';
export const SITE_DESCRIPTION =
  'Track your nutrition, workouts, and progress in one place. Build better habits and understand your journey with Trackwise.';

export const SUPPORT_EMAIL = 'ha.dh290702@gmail.com';
export const SUPPORT_PHONE = '0466522707';

/** Android listing. Update if the Play Console URL changes. */
export const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.trackwise.app';
/** Set when iOS ships. */
export const APP_STORE_URL = '';

// Re-enable + wire into the footer when public profiles exist.
// export const SOCIAL_TWITTER_URL = '';
// export const SOCIAL_INSTAGRAM_URL = '';
// export const SOCIAL_GITHUB_URL = '';

export const siteConfig = {
  name: SITE_NAME,
  legalName: SITE_LEGAL_NAME,
  tagline: SITE_TAGLINE,
  description: SITE_DESCRIPTION,
  domain: SITE_DOMAIN,
  url: SITE_URL,
  googlePlayUrl: GOOGLE_PLAY_URL,
  appStoreUrl: APP_STORE_URL,
  supportEmail: SUPPORT_EMAIL,
  supportPhone: SUPPORT_PHONE,
} as const;

export function isStoreAvailable(url: string): boolean {
  return url.length > 0;
}

export function getStoreStatus() {
  const googlePlay = isStoreAvailable(siteConfig.googlePlayUrl);
  const appStore = isStoreAvailable(siteConfig.appStoreUrl);
  return {
    googlePlay,
    appStore,
    anyAvailable: googlePlay || appStore,
    label: googlePlay || appStore ? 'Available now' : 'Coming soon',
  };
}
