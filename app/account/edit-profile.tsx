import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ImagePlus, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ChromeIconButton } from '@/components/ui/chrome-icon-button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Select } from '@/components/ui/select';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import {
  assertAvatarWithinSizeLimit,
  type SelectedAvatarImage,
  validateAvatarSelection,
} from '@/features/account/avatar';
import { useUpdateProfile } from '@/features/account/hooks';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { useAuth } from '@/features/auth/auth-provider';
import { useProfile } from '@/features/goals/hooks';
import type { Profile } from '@/features/goals/types';
import { ageFromBirthDate, birthDateFromAge, cmToFtIn, ftInToCm } from '@/features/setup/units';
import { isCloudinaryConfigured } from '@/lib/cloudinary/env';
import { uploadAvatarToCloudinary } from '@/lib/cloudinary/upload-avatar';
import { reportError } from '@/lib/errors/report-error';
import { iconSizes, radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/theme-provider';

function initialHeightFields(profile: Profile) {
  if (profile.height_cm == null) {
    return { heightCm: '', heightFt: '', heightIn: '' };
  }
  const { feet, inches } = cmToFtIn(profile.height_cm);
  return {
    heightCm: String(Math.round(profile.height_cm)),
    heightFt: String(feet),
    heightIn: String(inches),
  };
}

type EditProfileFormProps = {
  profile: Profile;
  email: string | undefined;
};

function EditProfileForm({ profile, email }: EditProfileFormProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const updateProfile = useUpdateProfile();
  const heightSeed = initialHeightFields(profile);

  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [sex, setSex] = useState<Profile['sex']>(profile.sex);
  const [units, setUnits] = useState<'metric' | 'imperial'>(profile.units);
  const [heightCm, setHeightCm] = useState(heightSeed.heightCm);
  const [heightFt, setHeightFt] = useState(heightSeed.heightFt);
  const [heightIn, setHeightIn] = useState(heightSeed.heightIn);
  const [age, setAge] = useState(
    profile.birth_date ? String(ageFromBirthDate(profile.birth_date)) : '',
  );
  const [activity, setActivity] = useState<Profile['activity_level']>(profile.activity_level);
  const [pendingAvatar, setPendingAvatar] = useState<SelectedAvatarImage | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (removeAvatar) return null;
    if (pendingAvatar) return pendingAvatar.uri;
    return profile.avatar_url ?? null;
  }, [pendingAvatar, profile.avatar_url, removeAvatar]);

  async function pickAvatar() {
    setError(null);
    if (!isCloudinaryConfigured()) {
      setError(t('account.cloudinaryRestartHint'));
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(t('account.photoLibraryDenied'));
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
      let selected = validateAvatarSelection({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      });
      selected = await assertAvatarWithinSizeLimit(selected);
      setPendingAvatar(selected);
      setRemoveAvatar(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('account.selectImageError'));
    }
  }

  async function onSave() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      let heightValue: number | null = null;
      if (units === 'metric') {
        const parsed = Number(heightCm.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(t('account.invalidHeight'));
        heightValue = parsed;
      } else {
        const ft = Number(heightFt.replace(',', '.'));
        const inch = Number(heightIn.replace(',', '.'));
        if (!Number.isFinite(ft) || !Number.isFinite(inch) || ft < 0 || inch < 0) {
          throw new Error(t('account.invalidHeight'));
        }
        heightValue = ftInToCm(ft, inch);
      }

      const ageNum = Number(age);
      if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
        throw new Error(t('account.invalidAge'));
      }

      let avatarUrl: string | null | undefined;
      if (removeAvatar) {
        avatarUrl = null;
      } else if (pendingAvatar) {
        const uploaded = await uploadAvatarToCloudinary(pendingAvatar);
        avatarUrl = uploaded.secureUrl;
      }

      await updateProfile.mutateAsync({
        display_name: displayName.trim() || null,
        sex,
        units,
        height_cm: heightValue,
        birth_date: birthDateFromAge(ageNum),
        activity_level: activity,
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      });

      router.back();
    } catch (err) {
      reportError(err, { area: 'account', action: 'update-profile' });
      setError(err instanceof Error ? err.message : t('account.saveProfileError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <View className="flex-row items-start gap-2">
        <ChromeIconButton
          header
          label={t('account.cancel')}
          onPress={() => router.back()}
          icon={(color) => <X size={22} color={color} />}
        />
        <Text variant="headingLarge" className="min-w-0 flex-1">
          {t('account.editProfile')}
        </Text>
      </View>

      <View className="items-center gap-3">
        {previewUrl ? (
          <Image
            source={{ uri: previewUrl }}
            style={{ width: 96, height: 96, borderRadius: 48 }}
            contentFit="cover"
          />
        ) : (
          <ProfileAvatar displayName={displayName} email={email} avatarUrl={null} size={96} />
        )}
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => void pickAvatar()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <ImagePlus size={iconSizes.sm} color={colors.primary} />
            <Text variant="label" tone="brand">
              {previewUrl ? t('account.replaceAvatar') : t('account.addAvatar')}
            </Text>
          </Pressable>
          {previewUrl || profile.avatar_url ? (
            <Pressable
              onPress={() => {
                setPendingAvatar(null);
                setRemoveAvatar(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Trash2 size={iconSizes.sm} color={colors.error} />
              <Text variant="label" tone="error">
                {t('account.removeAvatar')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Input
        label={t('account.displayName')}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
      />

      <Select
        label={t('account.sex')}
        value={sex}
        onChange={setSex}
        options={[
          { value: 'female', label: t('account.sexFemale') },
          { value: 'male', label: t('account.sexMale') },
          { value: 'other', label: t('account.sexOther') },
          { value: 'prefer_not_to_say', label: t('account.sexPreferNot') },
        ]}
      />

      <Select
        label={t('account.units')}
        value={units}
        onChange={setUnits}
        options={[
          { value: 'metric', label: t('account.metric') },
          { value: 'imperial', label: t('account.imperial') },
        ]}
      />

      {units === 'metric' ? (
        <Input
          label={`${t('account.height')} (cm)`}
          value={heightCm}
          onChangeText={setHeightCm}
          keyboardType="decimal-pad"
        />
      ) : (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input label="ft" value={heightFt} onChangeText={setHeightFt} keyboardType="number-pad" />
          </View>
          <View className="flex-1">
            <Input label="in" value={heightIn} onChangeText={setHeightIn} keyboardType="decimal-pad" />
          </View>
        </View>
      )}

      <Input label={t('account.age')} value={age} onChangeText={setAge} keyboardType="number-pad" />

      <Select
        label={t('account.activityLevel')}
        value={activity}
        onChange={setActivity}
        options={[
          { value: 'sedentary', label: t('account.activitySedentary') },
          { value: 'light', label: t('account.activityLight') },
          { value: 'moderate', label: t('account.activityModerate') },
          { value: 'demanding', label: t('account.activityDemanding') },
        ]}
      />

      {error ? (
        <Text variant="bodySmall" tone="error">
          {error}
        </Text>
      ) : null}

      <Button
        label={t('account.save')}
        loading={busy || updateProfile.isPending}
        disabled={busy}
        onPress={() => void onSave()}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const profileQuery = useProfile();

  if (profileQuery.isLoading) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <LoadingState label={t('account.editProfile')} />
      </Screen>
    );
  }

  if (profileQuery.error) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <ErrorState
          title={t('account.loadError')}
          body={
            profileQuery.error instanceof Error
              ? profileQuery.error.message
              : t('account.retry')
          }
          onRetry={() => void profileQuery.refetch()}
        />
      </Screen>
    );
  }

  if (!profileQuery.data) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']}>
        <ErrorState
          title={t('account.loadError')}
          body={t('account.retry')}
          onRetry={() => void profileQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboard edges={['top', 'bottom', 'left', 'right']}>
      <EditProfileForm
        key={profileQuery.data.id}
        profile={profileQuery.data}
        email={session?.user.email}
      />
    </Screen>
  );
}
