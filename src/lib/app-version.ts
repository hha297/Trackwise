import appJson from '../../app.json';

/**
 * Marketing version shown in About / Account.
 * Always follows `expo.version` in app.json — not the native binary, not package.json.
 */
export function getAppVersion(): string {
  const fromJson = appJson.expo?.version;
  if (typeof fromJson === 'string' && fromJson.trim().length > 0) {
    return fromJson.trim();
  }
  return '0.0.0';
}
