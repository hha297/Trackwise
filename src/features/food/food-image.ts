import {
  MAX_USER_IMAGE_SIZE_BYTES,
  assertUserImageWithinSizeLimit,
  formatUserImageSizeLimit,
  isAllowedUserImageMimeType,
  normalizeUserImageMimeType,
  resolveImageByteSize,
  validateUserImageSelection,
  type SelectedUserImage,
} from '@/lib/media/image-upload-limits';

/** Max food image size: 1 MB (client-side gate; also configure on Cloudinary preset). */
export const MAX_FOOD_IMAGE_SIZE_BYTES = MAX_USER_IMAGE_SIZE_BYTES;

export const FOOD_IMAGE_FOLDER = 'trackwise/foods';

export type SelectedFoodImage = SelectedUserImage;

export function formatFoodImageSizeLimit(): string {
  return formatUserImageSizeLimit();
}

export function normalizeImageMimeType(mimeType: string | null | undefined, uri: string): string {
  return normalizeUserImageMimeType(mimeType, uri);
}

export function isAllowedFoodImageMimeType(mimeType: string): boolean {
  return isAllowedUserImageMimeType(mimeType);
}

export function validateFoodImageSelection(input: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  emptyUriMessage?: string;
  invalidTypeMessage?: string;
  tooLargeMessage?: string;
}): SelectedFoodImage {
  const selected = validateUserImageSelection(input);
  return {
    ...selected,
    fileName: selected.fileName.startsWith('image.')
      ? `food.${selected.fileName.slice('image.'.length)}`
      : selected.fileName,
  };
}

/** Resolve byte size via fetch when the picker did not report fileSize. */
export async function resolveFoodImageByteSize(uri: string): Promise<number> {
  return resolveImageByteSize(uri);
}

export async function assertFoodImageWithinSizeLimit(
  image: SelectedFoodImage,
  tooLargeMessage?: string,
): Promise<SelectedFoodImage> {
  return assertUserImageWithinSizeLimit(image, tooLargeMessage);
}
