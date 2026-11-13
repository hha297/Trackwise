/**
 * An explicit saved URL (an admin upload) wins.
 * Otherwise the bundled file wins, so a replaced local image shows before it is uploaded.
 * Storage is only used when the app has no bundled file.
 */
export function preferredExerciseImage<T>(input: {
  remoteUrl?: string | null;
  storageUrl?: string | null;
  bundled?: T | null;
  placeholder: T;
}): string | T {
  const remote = input.remoteUrl?.trim();
  if (remote && /^https?:\/\//i.test(remote)) return remote;
  if (input.bundled != null) return input.bundled;
  const storage = input.storageUrl?.trim();
  if (storage && /^https?:\/\//i.test(storage)) return storage;
  return input.placeholder;
}
