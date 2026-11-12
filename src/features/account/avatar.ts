import {
  isAllowedFoodImageMimeType,
  normalizeImageMimeType,
  resolveFoodImageByteSize,
  type SelectedFoodImage,
} from '@/features/food/food-image';
import i18n from '@/i18n';

import { AVATAR_FOLDER, MAX_AVATAR_SIZE_BYTES } from './constants';

export type SelectedAvatarImage = SelectedFoodImage;

export function formatAvatarSizeLimit(): string {
  return `${MAX_AVATAR_SIZE_BYTES / (1024 * 1024)} MB`;
}

export function validateAvatarSelection(input: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}): SelectedAvatarImage {
  const uri = input.uri.trim();
  if (!uri) {
    throw new Error(i18n.t('errors.imageReadFailed'));
  }

  const mimeType = normalizeImageMimeType(input.mimeType, uri);
  if (!mimeType || !isAllowedFoodImageMimeType(mimeType)) {
    throw new Error(i18n.t('errors.imageTypeInvalid'));
  }

  const byteSize =
    typeof input.fileSize === 'number' && Number.isFinite(input.fileSize) && input.fileSize >= 0
      ? input.fileSize
      : null;

  if (byteSize != null && byteSize > MAX_AVATAR_SIZE_BYTES) {
    throw new Error(i18n.t('errors.avatarTooLarge', { limit: formatAvatarSizeLimit() }));
  }

  const fileName = input.fileName?.trim() || `avatar.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
  return { uri, mimeType, fileName, byteSize };
}

export async function assertAvatarWithinSizeLimit(
  image: SelectedAvatarImage,
): Promise<SelectedAvatarImage> {
  const byteSize = image.byteSize ?? (await resolveFoodImageByteSize(image.uri));
  if (byteSize > MAX_AVATAR_SIZE_BYTES) {
    throw new Error(i18n.t('errors.avatarTooLarge', { limit: formatAvatarSizeLimit() }));
  }
  return { ...image, byteSize };
}

export { AVATAR_FOLDER };

export function profileInitial(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = displayName?.trim();
  if (name) {
    const char = Array.from(name)[0];
    if (char) return char.toUpperCase();
  }
  const local = email?.split('@')[0]?.trim();
  if (local) {
    const char = Array.from(local)[0];
    if (char) return char.toUpperCase();
  }
  return 'C';
}
