import i18n from '@/i18n';
import { AVATAR_FOLDER, type SelectedAvatarImage } from '@/features/account/avatar';

import { getCloudinaryEnv, isCloudinaryConfigured } from './env';
import type { CloudinaryUploadResult } from './upload';

type CloudinaryUploadJson = {
  secure_url?: string;
  public_id?: string;
  error?: { message?: string };
};

/** Unsigned Cloudinary upload into the avatars folder. */
export async function uploadAvatarToCloudinary(
  image: SelectedAvatarImage,
): Promise<CloudinaryUploadResult> {
  const env = getCloudinaryEnv();
  if (!env) {
    throw new Error(
      'Cloudinary is not available in this build. Restart Expo with `npx expo start --clear` so EXPO_PUBLIC_CLOUDINARY_* from .env.local is loaded.',
    );
  }

  const form = new FormData();
  form.append('file', {
    uri: image.uri,
    type: image.mimeType,
    name: image.fileName || 'avatar.jpg',
  } as unknown as Blob);
  form.append('upload_preset', env.uploadPreset);
  form.append('folder', AVATAR_FOLDER);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.cloudName)}/image/upload`;

  let response: Response;
  try {
    response = await fetch(endpoint, { method: 'POST', body: form });
  } catch {
    throw new Error(i18n.t('errors.avatarUploadNetwork'));
  }

  let json: CloudinaryUploadJson = {};
  try {
    json = (await response.json()) as CloudinaryUploadJson;
  } catch {
    throw new Error(i18n.t('errors.uploadUnexpected'));
  }

  if (!response.ok) {
    const message = json.error?.message?.trim();
    if (message?.toLowerCase().includes('preset')) {
      throw new Error(i18n.t('errors.uploadPresetInvalid'));
    }
    if (message?.toLowerCase().includes('folder')) {
      throw new Error(
        'Cloudinary folder is not allowed by the upload preset. Allow folder trackwise/avatars (or remove folder restriction).',
      );
    }
    throw new Error(message || i18n.t('errors.avatarUploadFailed'));
  }

  const secureUrl = json.secure_url?.trim();
  const publicId = json.public_id?.trim();
  if (!secureUrl || !publicId) {
    throw new Error(i18n.t('errors.uploadNoUrl'));
  }

  return { secureUrl, publicId };
}

export { isCloudinaryConfigured };
