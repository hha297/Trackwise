import { preferredExerciseImage } from '@/features/workout/catalog/exercise-image-source';
import { LOCAL_EXERCISE_IMAGES } from '@/features/workout/catalog/exercise-local-images';
import { LOCAL_SUBCATEGORY_IMAGES } from '@/features/workout/catalog/subcategory-images';
import { getSupabase } from '@/lib/supabase/client';
import { getSupabaseEnv } from '@/lib/supabase/env';

/** Neutral placeholder when Storage path is missing/unavailable. Never use an unrelated exercise image. */
export const EXERCISE_IMAGE_PLACEHOLDER: number = require('../../../../assets/images/branding/logo.png');

export const EXERCISE_IMAGES_BUCKET = 'exercise-images';

export type ExerciseImageSource = string | number;

export { preferredExerciseImage };

const resolvedUrlCache = new Map<string, string>();

/**
 * Build a public Storage URL for a system exercise image path.
 * Prefers the Supabase client `getPublicUrl` helper; falls back to env URL.
 */
export function buildExerciseStoragePublicUrl(storagePath: string): string | null {
  const clean = storagePath.replace(/^\/+/, '').trim();
  if (!clean) return null;

  const cached = resolvedUrlCache.get(clean);
  if (cached) return cached;

  const supabase = getSupabase();
  if (supabase) {
    const { data } = supabase.storage.from(EXERCISE_IMAGES_BUCKET).getPublicUrl(clean);
    const url = data.publicUrl?.trim();
    if (url) {
      resolvedUrlCache.set(clean, url);
      return url;
    }
  }

  const env = getSupabaseEnv();
  if (!env?.url) return null;
  const url = `${env.url.replace(/\/$/, '')}/storage/v1/object/public/${EXERCISE_IMAGES_BUCKET}/${clean}`;
  resolvedUrlCache.set(clean, url);
  return url;
}

/** Cover tile for a library subcategory (`strength/chest`, `cardio/sports`, …). */
export function getSubcategoryImage(libraryPath: string): number | null {
  const hit = LOCAL_SUBCATEGORY_IMAGES[libraryPath];
  return hit != null ? (hit as number) : null;
}

/**
 * Display order: saved image URL (admin upload, cache-busted) → storage public URL →
 * bundled art → placeholder. Bundled files are the offline fallback, not the source of
 * an admin update. List thumbnails should not prefer multi-megabyte local JPEGs over a URL.
 */
function imageStems(value?: string | null): string[] {
  const raw = value?.trim().toLowerCase() ?? '';
  if (!raw) return [];
  const dashed = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const compact = dashed.replace(/-/g, '');
  return [raw, dashed, compact].filter(Boolean);
}

function localExerciseImage(input: {
  imageKey?: string | null;
  slug?: string | null;
  name?: string | null;
}): ExerciseImageSource | null {
  for (const stem of [
    ...imageStems(input.imageKey),
    ...imageStems(input.slug),
    ...imageStems(input.name),
  ]) {
    const hit = LOCAL_EXERCISE_IMAGES[stem];
    if (hit != null) return hit as ExerciseImageSource;
  }
  return null;
}

/**
 * A saved image URL wins. With no saved URL, bundled art wins over the shared
 * Storage object so a local replacement shows before that file is uploaded.
 */
export function resolveExerciseImage(input: {
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageKey?: string | null;
  slug?: string | null;
  name?: string | null;
}): ExerciseImageSource {
  const storagePath =
    input.imageStoragePath?.trim() ||
    (input.imageKey ? `exercises/shared/${input.imageKey}.webp` : null) ||
    (input.slug ? `exercises/shared/${input.slug}.webp` : null);
  return preferredExerciseImage({
    remoteUrl: input.imageUrl,
    storageUrl: storagePath ? buildExerciseStoragePublicUrl(storagePath) : null,
    bundled: localExerciseImage(input),
    placeholder: EXERCISE_IMAGE_PLACEHOLDER,
  });
}

/** Used when the remote image fails. Keeps a real exercise photo instead of a blank error. */
export function fallbackExerciseImage(input: {
  imageKey?: string | null;
  slug?: string | null;
  name?: string | null;
}): ExerciseImageSource {
  return localExerciseImage(input) ?? EXERCISE_IMAGE_PLACEHOLDER;
}
