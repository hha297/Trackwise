import { archiveExercise, saveExercise, uploadExerciseImage } from '@/features/exercises/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, TextArea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { resolveExerciseImageUrl } from '@/features/exercises/exercise-images';
import { getDictionary } from '@/i18n';

export type ExerciseFormValues = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  category?: string | null;
  exercise_type?: string | null;
  difficulty?: string | null;
  equipment?: string | null;
  movement_pattern?: string | null;
  primary_muscles?: string[] | null;
  secondary_muscles?: string[] | null;
  met_value?: number | null;
  instructions?: string | null;
  overview?: string | null;
  tips?: string | null;
  common_mistakes?: string | null;
  safety_notes?: string | null;
  description?: string | null;
  image_key?: string | null;
  image_url?: string | null;
  image_storage_path?: string | null;
  library_paths?: string[] | null;
  archived_at?: string | null;
};

export function ExerciseForm({
  exercise,
  saved,
}: {
  exercise?: ExerciseFormValues;
  saved?: boolean;
}) {
  const t = getDictionary();
  const join = (value?: string[] | null) => (value ?? []).join(', ');
  const previewUrl = resolveExerciseImageUrl({
    imageUrl: exercise?.image_url,
    imageStoragePath: exercise?.image_storage_path,
    imageKey: exercise?.image_key,
    slug: exercise?.slug,
  });

  return (
    <div className="space-y-5">
      {saved ? (
        <Card className="border-primary/30 bg-primary/15 text-sm text-ink">
          {t.exercises.saved}
        </Card>
      ) : null}
      <form action={saveExercise} className="grid gap-4 lg:grid-cols-2">
        {exercise?.id ? <input type="hidden" name="id" value={exercise.id} /> : null}
        <div>
          <Label htmlFor="name">{t.exercises.name}</Label>
          <Input id="name" name="name" required defaultValue={exercise?.name ?? ''} />
        </div>
        <div>
          <Label htmlFor="slug">{t.exercises.slug}</Label>
          <Input id="slug" name="slug" defaultValue={exercise?.slug ?? ''} />
        </div>
        <div>
          <Label htmlFor="category">{t.exercises.category}</Label>
          <Input id="category" name="category" required defaultValue={exercise?.category ?? 'Strength'} />
        </div>
        <div>
          <Label htmlFor="exercise_type">{t.exercises.type}</Label>
          <Select
            id="exercise_type"
            name="exercise_type"
            defaultValue={exercise?.exercise_type ?? 'strength'}
            className="w-full"
          >
            <option value="strength">Strength</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="cardio">Cardio</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="difficulty">{t.exercises.difficulty}</Label>
          <Input id="difficulty" name="difficulty" defaultValue={exercise?.difficulty ?? ''} />
        </div>
        <div>
          <Label htmlFor="equipment">{t.exercises.equipment}</Label>
          <Input id="equipment" name="equipment" defaultValue={exercise?.equipment ?? ''} />
        </div>
        <div>
          <Label htmlFor="movement_pattern">Movement pattern</Label>
          <Input
            id="movement_pattern"
            name="movement_pattern"
            defaultValue={exercise?.movement_pattern ?? ''}
          />
        </div>
        <div>
          <Label htmlFor="met_value">{t.exercises.met}</Label>
          <Input
            id="met_value"
            name="met_value"
            type="number"
            step="0.1"
            defaultValue={exercise?.met_value ?? ''}
          />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="primary_muscles">{t.exercises.primaryMuscles}</Label>
          <Input
            id="primary_muscles"
            name="primary_muscles"
            defaultValue={join(exercise?.primary_muscles)}
            placeholder="comma-separated"
          />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="secondary_muscles">{t.exercises.secondaryMuscles}</Label>
          <Input
            id="secondary_muscles"
            name="secondary_muscles"
            defaultValue={join(exercise?.secondary_muscles)}
            placeholder="comma-separated"
          />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="library_paths">Library paths</Label>
          <Input
            id="library_paths"
            name="library_paths"
            defaultValue={join(exercise?.library_paths)}
            placeholder="strength/back, strength/quadriceps"
          />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="description">{t.exercises.overview}</Label>
          <p className="mb-1.5 text-xs text-ash">
            Same field as mobile Overview (`description`).
          </p>
          <TextArea
            id="description"
            name="description"
            rows={5}
            defaultValue={exercise?.description ?? ''}
          />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="instructions">{t.exercises.instructions}</Label>
          <TextArea
            id="instructions"
            name="instructions"
            rows={6}
            defaultValue={exercise?.instructions ?? ''}
          />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="tips">{t.exercises.tips}</Label>
          <TextArea id="tips" name="tips" rows={4} defaultValue={exercise?.tips ?? ''} />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="common_mistakes">{t.exercises.mistakes}</Label>
          <TextArea
            id="common_mistakes"
            name="common_mistakes"
            rows={4}
            defaultValue={exercise?.common_mistakes ?? ''}
          />
        </div>
        <div className="lg:col-span-2">
          <Label htmlFor="safety_notes">{t.exercises.safety}</Label>
          <TextArea
            id="safety_notes"
            name="safety_notes"
            rows={4}
            defaultValue={exercise?.safety_notes ?? ''}
          />
        </div>
        <div>
          <Label htmlFor="image_key">Image key</Label>
          <Input id="image_key" name="image_key" defaultValue={exercise?.image_key ?? ''} />
        </div>
        <div className="flex items-end">
          <Button type="submit">{t.common.save}</Button>
        </div>
      </form>

      {exercise?.id ? (
        <>
          <Card className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">{t.exercises.image}</h3>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={exercise.name ?? 'Exercise'}
                className="h-48 w-full max-w-md rounded-[10px] object-cover"
              />
            ) : (
              <p className="text-sm text-ash">No Storage image resolved yet.</p>
            )}
            <p className="font-mono-metric text-xs text-mute">
              {exercise.image_storage_path || 'no image_storage_path'}
            </p>
            <form action={uploadExerciseImage} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={exercise.id} />
              <div>
                <Label htmlFor="file">Upload</Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  required
                />
              </div>
              <Button type="submit" variant="secondary">
                Upload image
              </Button>
            </form>
          </Card>

          <form action={archiveExercise} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={exercise.id} />
            <input
              type="hidden"
              name="restore"
              value={exercise.archived_at ? '1' : '0'}
            />
            <Button type="submit" variant={exercise.archived_at ? 'secondary' : 'danger'}>
              {exercise.archived_at ? t.common.restore : t.common.archive}
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
