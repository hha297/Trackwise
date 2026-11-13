import type { PermissionSnapshot } from './types';

/** Minimal shape used by unit tests and the expo-notifications adapter. */
export type PermissionStatusLike = {
  status?: string;
  granted?: boolean;
  canAskAgain?: boolean;
  ios?: { status?: number };
};

/** iOS authorization status numeric values from expo-notifications. */
export const IOS_AUTH = {
  NOT_DETERMINED: 0,
  DENIED: 1,
  AUTHORIZED: 2,
  PROVISIONAL: 3,
  EPHEMERAL: 4,
} as const;

export function mapPermissionResponse(
  response: PermissionStatusLike,
  platform: string,
): PermissionSnapshot {
  if (platform === 'web') {
    return { status: 'unavailable', canAskAgain: false, canNotify: false };
  }

  const iosStatus = response.ios?.status;
  if (iosStatus != null) {
    if (
      iosStatus === IOS_AUTH.AUTHORIZED ||
      iosStatus === IOS_AUTH.PROVISIONAL ||
      iosStatus === IOS_AUTH.EPHEMERAL
    ) {
      return { status: 'granted', canAskAgain: false, canNotify: true };
    }
    if (iosStatus === IOS_AUTH.DENIED) {
      return {
        status: 'denied',
        canAskAgain: response.canAskAgain !== false,
        canNotify: false,
      };
    }
    return { status: 'undetermined', canAskAgain: true, canNotify: false };
  }

  // Prefer the boolean when present — some Android builds report granted=true
  // while status strings are delayed/stale right after the system dialog.
  if (response.granted === true || response.status === 'granted') {
    return { status: 'granted', canAskAgain: false, canNotify: true };
  }
  if (response.status === 'denied') {
    return {
      status: 'denied',
      canAskAgain: response.canAskAgain !== false,
      canNotify: false,
    };
  }
  if (response.status === 'undetermined') {
    return {
      status: 'undetermined',
      canAskAgain: response.canAskAgain !== false,
      canNotify: false,
    };
  }

  return { status: 'unavailable', canAskAgain: false, canNotify: false };
}
