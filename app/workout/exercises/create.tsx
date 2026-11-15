import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useCreateCustomExercise } from '@/features/workout/hooks';
import type { ExerciseType } from '@/features/workout/types';
import { uploadCustomExerciseImageToCloudinary } from '@/lib/cloudinary/upload-custom-exercise';
import {
  assertUserImageWithinSizeLimit,
  formatUserImageSizeLimit,
  validateUserImageSelection,
  type SelectedUserImage,
} from '@/lib/media/image-upload-limits';
import { useActiveWorkoutStore } from '@/stores/active-workout-store';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

const TYPES: ExerciseType[] = ['strength', 'bodyweight', 'cardio', 'other'];

export default function CreateCustomExerciseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const create = useCreateCustomExercise();
  const addExercise = useActiveWorkoutStore((state) => state.addExercise);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Custom');
  const [type, setType] = useState<ExerciseType>('strength');
  const [equipment, setEquipment] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<SelectedUserImage | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('workout.imagePermissionTitle'), t('workout.imagePermissionBody'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.85,
        exif: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      let selected = validateUserImageSelection({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      });
      selected = await assertUserImageWithinSizeLimit(selected);
      setImage(selected);
    } catch (error) {
      Alert.alert(
        t('workout.saveFailed'),
        error instanceof Error ? error.message : t('workout.retry'),
      );
    }
  }

  async function onSave() {
    if (!name.trim()) {
      Alert.alert(t('workout.customRequired'));
      return;
    }
    try {
      setUploading(true);
      let imageUrl: string | null = null;
      if (image) {
        const uploaded = await uploadCustomExerciseImageToCloudinary(image);
        imageUrl = uploaded.secureUrl;
      }
      const exercise = await create.mutateAsync({
        name: name.trim(),
        category: category.trim() || 'Other',
        exerciseType: type,
        equipment: equipment.trim() || null,
        description: description.trim() || null,
        imageUrl,
      });
      const hasActive = useActiveWorkoutStore.getState().startedAt;
      if (hasActive) {
        addExercise({
          exerciseId: exercise.id,
          name: exercise.name,
          exerciseType: exercise.exercise_type,
          metValue: exercise.met_value,
          primaryMuscles: exercise.primary_muscles,
          imageUrl: exercise.image_url,
          imageStoragePath: exercise.image_storage_path,
          imageKey: exercise.image_key,
          slug: exercise.slug,
        });
      }
      router.back();
    } catch (error) {
      Alert.alert(
        t('workout.saveFailed'),
        error instanceof Error ? error.message : t('workout.retry'),
      );
    } finally {
      setUploading(false);
    }
  }

  const busy = create.isPending || uploading;

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <View className="gap-4">
        <View className="flex-row items-start gap-2">
          <ChromeIconButton
            header
            label={t('workout.close')}
            onPress={() => router.back()}
            icon={(color) => <X size={22} color={color} />}
          />
          <Text variant="headingLarge" className="min-w-0 flex-1">
            {t('workout.createCustom')}
          </Text>
        </View>

        <Pressable
          onPress={() => void pickImage()}
          disabled={busy}
          className="items-center justify-center overflow-hidden"
          style={{
            height: 160,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          {image ? (
            <Image source={image.uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <View className="items-center gap-1 px-4">
              <Text variant="bodyStrong">{t('workout.addExerciseImage')}</Text>
              <Text variant="caption" tone="muted">
                {t('workout.imageSizeLimit', { size: formatUserImageSizeLimit() })}
              </Text>
            </View>
          )}
        </Pressable>
        {image ? (
          <Pressable onPress={() => setImage(null)} disabled={busy}>
            <Text variant="caption" tone="brand">
              {t('workout.removeImage')}
            </Text>
          </Pressable>
        ) : null}

        <Input label={t('workout.exerciseName')} value={name} onChangeText={setName} />
        <Input label={t('workout.categoryLabel')} value={category} onChangeText={setCategory} />
        <Input
          label={t('workout.equipmentOptional')}
          value={equipment}
          onChangeText={setEquipment}
        />
        <Input
          label={t('workout.descriptionOptional')}
          value={description}
          onChangeText={setDescription}
        />

        <Text variant="label" tone="secondary">
          {t('workout.trackingType')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {TYPES.map((item) => {
            const selected = type === item;
            return (
              <Pressable
                key={item}
                onPress={() => setType(item)}
                className="px-3 py-2"
                style={{
                  borderRadius: radii.pill,
                  backgroundColor: selected ? colors.primaryMuted : colors.surfaceMuted,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? colors.primary : colors.border,
                }}
              >
                <Text variant="caption" tone={selected ? 'brand' : 'secondary'}>
                  {t(`workout.type.${item}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={t('workout.saveCustom')}
          onPress={() => {
            void onSave();
          }}
          loading={busy}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}
