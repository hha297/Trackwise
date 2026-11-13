-- Allow AVIF system exercise artwork in the public exercise-images bucket.
update storage.buckets
set allowed_mime_types = array[
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/avif'
]::text[]
where id = 'exercise-images';
