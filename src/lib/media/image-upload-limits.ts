/** Shared client-side max for Cloudinary user uploads (avatar, food, custom exercise). */
export const MAX_USER_IMAGE_SIZE_BYTES = 1 * 1024 * 1024;

export const ALLOWED_USER_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const ALLOWED_USER_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
]);

export function formatUserImageSizeLimit(): string {
  return `${MAX_USER_IMAGE_SIZE_BYTES / (1024 * 1024)} MB`;
}

export function normalizeUserImageMimeType(
  mimeType: string | null | undefined,
  uri: string,
): string {
  const trimmed = mimeType?.trim().toLowerCase();
  if (trimmed && trimmed !== 'application/octet-stream') {
    if (trimmed === 'image/jpg') return 'image/jpeg';
    return trimmed;
  }
  const ext = extensionFromUri(uri);
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  return '';
}

export function isAllowedUserImageMimeType(mimeType: string): boolean {
  return ALLOWED_USER_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

export type SelectedUserImage = {
  uri: string;
  mimeType: string;
  fileName: string;
  byteSize: number | null;
};

export function validateUserImageSelection(input: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  emptyUriMessage?: string;
  invalidTypeMessage?: string;
  tooLargeMessage?: string;
}): SelectedUserImage {
  const uri = input.uri.trim();
  if (!uri) {
    throw new Error(
      input.emptyUriMessage ?? 'Could not read the selected image. Try another photo.',
    );
  }

  const mimeType = normalizeUserImageMimeType(input.mimeType, uri);
  if (!mimeType || !isAllowedUserImageMimeType(mimeType)) {
    throw new Error(input.invalidTypeMessage ?? 'Use a JPEG, PNG, or WebP image.');
  }

  const byteSize =
    typeof input.fileSize === 'number' && Number.isFinite(input.fileSize) && input.fileSize >= 0
      ? input.fileSize
      : null;

  if (byteSize != null && byteSize > MAX_USER_IMAGE_SIZE_BYTES) {
    throw new Error(
      input.tooLargeMessage ?? `Image must be ${formatUserImageSizeLimit()} or smaller.`,
    );
  }

  const fileName =
    input.fileName?.trim() ||
    `image.${extensionFromUri(uri) || mimeExtension(mimeType) || 'jpg'}`;

  const ext = extensionFromFileName(fileName);
  if (ext && !ALLOWED_USER_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(input.invalidTypeMessage ?? 'Use a JPEG, PNG, or WebP image.');
  }

  return { uri, mimeType, fileName, byteSize };
}

export async function resolveImageByteSize(uri: string): Promise<number> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read the selected image. Try another photo.');
  }
  const blob = await response.blob();
  return blob.size;
}

export async function assertUserImageWithinSizeLimit(
  image: SelectedUserImage,
  tooLargeMessage?: string,
): Promise<SelectedUserImage> {
  const byteSize = image.byteSize ?? (await resolveImageByteSize(image.uri));
  if (byteSize > MAX_USER_IMAGE_SIZE_BYTES) {
    throw new Error(
      tooLargeMessage ?? `Image must be ${formatUserImageSizeLimit()} or smaller.`,
    );
  }
  return { ...image, byteSize };
}

function extensionFromUri(uri: string): string {
  const cleaned = uri.split('?')[0] ?? uri;
  const match = cleaned.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? '';
}

function extensionFromFileName(fileName: string): string {
  const match = fileName.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? '';
}

function mimeExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';
  return 'jpg';
}
