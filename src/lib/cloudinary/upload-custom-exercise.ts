import i18n from '@/i18n';
import {
  assertUserImageWithinSizeLimit,
  type SelectedUserImage,
} from '@/lib/media/image-upload-limits';

import { getCloudinaryEnv } from './env';

export const CUSTOM_EXERCISE_IMAGE_FOLDER = 'trackwise/custom-exercises';

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
 * Unsigned Cloudinary upload for user custom exercise images (max 1 MB).
 * Never send API secrets from the client.
 */
export async function uploadCustomExerciseImageToCloudinary(
  image: SelectedUserImage,
): Promise<CloudinaryUploadResult> {
  const env = getCloudinaryEnv();
  if (!env) {
    throw new Error(
      'Exercise image upload is not configured. Add Cloudinary cloud name and upload preset to your environment.',
    );
  }

  const validated = await assertUserImageWithinSizeLimit(image);

  const form = new FormData();
  form.append('file', {
    uri: validated.uri,
    type: validated.mimeType,
    name: validated.fileName,
  } as unknown as Blob);
  form.append('upload_preset', env.uploadPreset);
  form.append('folder', CUSTOM_EXERCISE_IMAGE_FOLDER);

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
