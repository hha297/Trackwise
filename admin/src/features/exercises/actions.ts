'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const exerciseSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional().nullable(),
  category: z.string().trim().min(1).max(80),
  exercise_type: z.enum(['strength', 'bodyweight', 'cardio', 'other']),
  difficulty: z.string().trim().max(40).optional().nullable(),
  equipment: z.string().trim().max(80).optional().nullable(),
  movement_pattern: z.string().trim().max(80).optional().nullable(),
  primary_muscles: z.string().trim().optional().nullable(),
  secondary_muscles: z.string().trim().optional().nullable(),
  met_value: z.coerce.number().min(0).max(30).optional().nullable(),
  instructions: z.string().optional().nullable(),
  overview: z.string().optional().nullable(),
  tips: z.string().optional().nullable(),
  common_mistakes: z.string().optional().nullable(),
  safety_notes: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image_key: z.string().optional().nullable(),
  library_paths: z.string().optional().nullable(),
});

function splitList(value: string | null | undefined) {
  if (!value?.trim()) return [] as string[];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function saveExercise(formData: FormData) {
  await requireAdmin();
  const parsed = exerciseSchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    slug: formData.get('slug') || null,
    category: formData.get('category'),
    exercise_type: formData.get('exercise_type'),
    difficulty: formData.get('difficulty') || null,
    equipment: formData.get('equipment') || null,
    movement_pattern: formData.get('movement_pattern') || null,
    primary_muscles: formData.get('primary_muscles'),
    secondary_muscles: formData.get('secondary_muscles'),
    met_value: formData.get('met_value') || null,
    instructions: formData.get('instructions') || null,
    overview: formData.get('overview') || null,
    tips: formData.get('tips') || null,
    common_mistakes: formData.get('common_mistakes') || null,
    safety_notes: formData.get('safety_notes') || null,
    description: formData.get('description') || null,
    image_key: formData.get('image_key') || null,
    library_paths: formData.get('library_paths') || null,
  });

  if (!parsed.success) {
    redirect('/exercises?error=validation');
  }

  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug || null,
    category: parsed.data.category,
    exercise_type: parsed.data.exercise_type,
    difficulty: parsed.data.difficulty,
    equipment: parsed.data.equipment,
    movement_pattern: parsed.data.movement_pattern,
    primary_muscles: splitList(parsed.data.primary_muscles),
    secondary_muscles: splitList(parsed.data.secondary_muscles),
    met_value: parsed.data.met_value,
    instructions: parsed.data.instructions,
    overview: parsed.data.overview,
    tips: parsed.data.tips,
    common_mistakes: parsed.data.common_mistakes,
    safety_notes: parsed.data.safety_notes,
    description: parsed.data.description,
    image_key: parsed.data.image_key,
    library_paths: splitList(parsed.data.library_paths),
    is_system: true,
    user_id: null,
  };

  const supabase = await createClient();
  if (parsed.data.id) {
    const { error } = await supabase
      .from('exercises')
      .update(payload)
      .eq('id', parsed.data.id)
      .eq('is_system', true);
    if (error) redirect(`/exercises/${parsed.data.id}?error=save`);
    await supabase.rpc('admin_write_audit', {
      p_action: 'exercise.update',
      p_target_type: 'exercises',
      p_target_id: parsed.data.id,
      p_reason: null,
      p_before: null,
      p_after: payload,
    });
    revalidatePath('/exercises');
    redirect(`/exercises/${parsed.data.id}?saved=1`);
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert(payload)
    .select('id')
    .single();
  if (error || !data) redirect('/exercises/new?error=save');
  await supabase.rpc('admin_write_audit', {
    p_action: 'exercise.create',
    p_target_type: 'exercises',
    p_target_id: data.id,
    p_reason: null,
    p_before: null,
    p_after: payload,
  });
  revalidatePath('/exercises');
  redirect(`/exercises/${data.id}?saved=1`);
}

/** Compact list-modal save — stays on /exercises. */
export async function quickSaveExercise(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const parsed = exerciseSchema.safeParse({
    id,
    name: formData.get('name'),
    category: formData.get('category'),
    exercise_type: formData.get('exercise_type'),
    difficulty: formData.get('difficulty') || null,
    equipment: formData.get('equipment') || null,
    description: formData.get('description') || null,
    instructions: formData.get('instructions') || null,
  });
  if (!parsed.success || !id) {
    throw new Error('Validation failed');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('exercises')
    .update({
      name: parsed.data.name,
      category: parsed.data.category,
      exercise_type: parsed.data.exercise_type,
      difficulty: parsed.data.difficulty,
      equipment: parsed.data.equipment,
      description: parsed.data.description,
      instructions: parsed.data.instructions,
      is_system: true,
      user_id: null,
    })
    .eq('id', id)
    .eq('is_system', true);
  if (error) throw error;

  await supabase.rpc('admin_write_audit', {
    p_action: 'exercise.quick_update',
    p_target_type: 'exercises',
    p_target_id: id,
    p_reason: null,
    p_before: null,
    p_after: {
      name: parsed.data.name,
      category: parsed.data.category,
      exercise_type: parsed.data.exercise_type,
    },
  });
  revalidatePath('/exercises');
  revalidatePath(`/exercises/${id}`);
}

/** Permanently delete a system exercise from the catalog. */
export async function deleteExercise(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Exercise id required');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', id)
    .eq('is_system', true)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Exercise was not deleted (not found or not allowed)');

  await supabase.rpc('admin_write_audit', {
    p_action: 'exercise.delete',
    p_target_type: 'exercises',
    p_target_id: id,
    p_reason: 'admin.delete_exercise',
    p_before: null,
    p_after: { deleted: true },
  });
  revalidatePath('/exercises');
}

/** Permanently delete multiple system exercises at once. */
export async function deleteExercises(ids: string[]) {
  await requireAdmin();
  const uniqueIds = [...new Set(ids.map(String).filter(Boolean))];
  if (!uniqueIds.length) throw new Error('No exercises selected');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('exercises')
    .delete()
    .in('id', uniqueIds)
    .eq('is_system', true)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('No exercises were deleted (not found or not allowed)');

  await Promise.all(
    data.map((row) =>
      supabase.rpc('admin_write_audit', {
        p_action: 'exercise.delete',
        p_target_type: 'exercises',
        p_target_id: row.id,
        p_reason: 'admin.bulk_delete_exercises',
        p_before: null,
        p_after: { deleted: true },
      }),
    ),
  );
  revalidatePath('/exercises');
  return { deleted: data.length };
}

export async function archiveExercise(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const restore = String(formData.get('restore') ?? '') === '1';
  const supabase = await createClient();
  const { error } = await supabase
    .from('exercises')
    .update({ archived_at: restore ? null : new Date().toISOString() })
    .eq('id', id)
    .eq('is_system', true);
  if (error) redirect(`/exercises/${id}?error=archive`);
  await supabase.rpc('admin_write_audit', {
    p_action: restore ? 'exercise.restore' : 'exercise.archive',
    p_target_type: 'exercises',
    p_target_id: id,
    p_reason: 'admin.archive_exercise',
    p_before: null,
    p_after: { archived: !restore },
  });
  revalidatePath('/exercises');
  redirect('/exercises');
}

export async function uploadExerciseImage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const file = formData.get('file');
  if (!id || !(file instanceof File)) {
    redirect(`/exercises/${id}?error=image`);
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    redirect(`/exercises/${id}?error=image-type`);
  }
  if (file.size > 5 * 1024 * 1024) {
    redirect(`/exercises/${id}?error=image-size`);
  }

  const supabase = await createClient();
  const { data: exercise } = await supabase
    .from('exercises')
    .select('slug, image_storage_path, content_version')
    .eq('id', id)
    .eq('is_system', true)
    .maybeSingle();
  if (!exercise) redirect('/exercises?error=notfound');

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `exercises/shared/${exercise.slug || id}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('exercise-images')
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (uploadError) redirect(`/exercises/${id}?error=image-upload`);

  const version = (exercise.content_version ?? 0) + 1;
  const { data: publicUrl } = supabase.storage.from('exercise-images').getPublicUrl(path);
  const imageUrl = `${publicUrl.publicUrl}${publicUrl.publicUrl.includes('?') ? '&' : '?'}v=${version}`;
  const { error: updateError } = await supabase
    .from('exercises')
    .update({
      image_storage_path: path,
      image_url: imageUrl,
      image_key: exercise.slug || id,
      content_version: version,
    })
    .eq('id', id)
    .eq('is_system', true);
  if (updateError) redirect(`/exercises/${id}?error=image-upload`);

  if (exercise.image_storage_path && exercise.image_storage_path !== path) {
    await supabase.storage.from('exercise-images').remove([exercise.image_storage_path]);
  }

  await supabase.rpc('admin_write_audit', {
    p_action: 'exercise.image',
    p_target_type: 'exercises',
    p_target_id: id,
    p_reason: null,
    p_before: null,
    p_after: { image_storage_path: path },
  });

  revalidatePath(`/exercises/${id}`);
  redirect(`/exercises/${id}?saved=1`);
}
