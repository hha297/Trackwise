import { describe, expect, it } from 'vitest';

import { preferredExerciseImage } from './exercise-image-source';

describe('preferredExerciseImage', () => {
  it('uses an updated remote URL ahead of bundled art', () => {
    expect(
      preferredExerciseImage({
        remoteUrl: 'https://images.example/pec-deck-fly.jpg?v=2',
        storageUrl: 'https://storage.example/pec-deck-fly.webp',
        bundled: 'local-file',
        placeholder: 'logo',
      }),
    ).toBe('https://images.example/pec-deck-fly.jpg?v=2');
  });

  it('uses bundled art ahead of the shared storage file when no upload URL is saved', () => {
    expect(
      preferredExerciseImage({
        remoteUrl: null,
        storageUrl: 'https://storage.example/barbell-bench-press.webp',
        bundled: 'local-file',
        placeholder: 'logo',
      }),
    ).toBe('local-file');
  });

  it('falls back to bundled art when no remote URL exists', () => {
    expect(
      preferredExerciseImage({
        remoteUrl: '  ',
        storageUrl: null,
        bundled: 'local-file',
        placeholder: 'logo',
      }),
    ).toBe('local-file');
  });

  it('uses the placeholder when nothing else is available', () => {
    expect(
      preferredExerciseImage({
        remoteUrl: 'not-a-url',
        storageUrl: '',
        bundled: null,
        placeholder: 'logo',
      }),
    ).toBe('logo');
  });
});
