import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { mapPermissionResponse } from './permission-map';
import type { PermissionSnapshot } from './types';

export { mapPermissionResponse } from './permission-map';

export async function getNotificationPermission(): Promise<PermissionSnapshot> {
  if (Platform.OS === 'web') {
    return { status: 'unavailable', canAskAgain: false, canNotify: false };
  }
  try {
    const response = await Notifications.getPermissionsAsync();
    return mapPermissionResponse(response, Platform.OS);
  } catch {
    return { status: 'unavailable', canAskAgain: false, canNotify: false };
  }
}

export async function requestNotificationPermission(): Promise<PermissionSnapshot> {
  if (Platform.OS === 'web') {
    return { status: 'unavailable', canAskAgain: false, canNotify: false };
  }
  try {
    const response = await Notifications.requestPermissionsAsync();
    return mapPermissionResponse(response, Platform.OS);
  } catch {
    return { status: 'unavailable', canAskAgain: false, canNotify: false };
  }
}
