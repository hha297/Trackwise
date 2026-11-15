import i18n from '@/i18n';
import {
  FOOD_IMAGE_FOLDER,
  type SelectedFoodImage,
} from '@/features/food/food-image';

import { getCloudinaryEnv } from './env';

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

type CloudinaryUploadJson = {
  secure_url?: string;
  public_id?: string;
  error?: { message?: string };
};

/**
 * Unsigned Cloudinary image upload (mobile-safe).
 * Requires EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME + EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.
 * Never send API secrets from the client.
 */
export async function uploadFoodImageToCloudinary(
  image: SelectedFoodImage,
): Promise<CloudinaryUploadResult> {
  const env = getCloudinaryEnv();
  if (!env) {
    throw new Error(
      i18n.t('errors.uploadNotConfigured'),
    );
  }

  const form = new FormData();
  form.append('file', {
    uri: image.uri,
    type: image.mimeType,
    name: image.fileName,
  } as unknown as Blob);
  form.append('upload_preset', env.uploadPreset);
  form.append('folder', FOOD_IMAGE_FOLDER);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.cloudName)}/image/upload`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new Error(i18n.t('errors.uploadNetwork'));
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
    throw new Error(message || i18n.t('errors.uploadFailed'));
  }

  const secureUrl = json.secure_url?.trim();
  const publicId = json.public_id?.trim();
  if (!secureUrl || !publicId) {
    throw new Error(i18n.t('errors.uploadNoUrl'));
  }

  return { secureUrl, publicId };
}
