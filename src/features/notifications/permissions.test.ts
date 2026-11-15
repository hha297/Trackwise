import { describe, expect, it } from 'vitest';

import { IOS_AUTH, mapPermissionResponse } from './permission-map';

describe('mapPermissionResponse', () => {
  it('maps granted android-style statuses', () => {
    expect(
      mapPermissionResponse(
        { status: 'granted', granted: true, canAskAgain: false },
        'android',
      ),
    ).toMatchObject({ status: 'granted', canNotify: true });
  });

  it('maps denied statuses', () => {
    expect(
      mapPermissionResponse(
        { status: 'denied', granted: false, canAskAgain: false },
        'android',
      ),
    ).toMatchObject({ status: 'denied', canNotify: false, canAskAgain: false });
  });

  it('maps undetermined statuses', () => {
    expect(
      mapPermissionResponse(
        { status: 'undetermined', granted: false, canAskAgain: true },
        'ios',
      ),
    ).toMatchObject({ status: 'undetermined', canNotify: false, canAskAgain: true });
  });

  it('maps iOS authorized / provisional / denied', () => {
    expect(
      mapPermissionResponse({ ios: { status: IOS_AUTH.AUTHORIZED } }, 'ios'),
    ).toMatchObject({ status: 'granted', canNotify: true });
    expect(
      mapPermissionResponse({ ios: { status: IOS_AUTH.PROVISIONAL } }, 'ios'),
    ).toMatchObject({ status: 'granted', canNotify: true });
    expect(
      mapPermissionResponse({ ios: { status: IOS_AUTH.DENIED }, canAskAgain: false }, 'ios'),
    ).toMatchObject({ status: 'denied', canNotify: false });
  });

  it('treats web as unavailable', () => {
    expect(mapPermissionResponse({ status: 'granted', granted: true }, 'web')).toMatchObject({
      status: 'unavailable',
      canNotify: false,
    });
  });
});
