import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, ChevronLeft, ImageIcon, Pencil, User } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Button,
  Input,
  ScrollView,
  Sheet,
  Spinner,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
} from 'tamagui';

import { useAvatarPicker } from '@/features/auth/hooks/useAvatarPicker';
import { useCoverPicker } from '@/features/auth/hooks/useCoverPicker';
import { useUsernameAvailability } from '@/features/auth/hooks/useUsernameAvailability';
import { useEditProfile } from '@/features/profile/hooks/useEditProfile';
import { useProfileQuery } from '@/features/profile/hooks/useProfileQuery';
import {
  editProfileSchema,
  type EditProfileFormValues,
} from '@/features/profile/schemas/editProfileSchema';

const logoSource = require('../../../assets/Logo-Doumassi.png') as number;

const USERNAME_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function getUsernameCooldown(changedAt: string | null) {
  if (!changedAt) return { active: false, nextDate: null, daysRemaining: 0 };

  const changedDate = new Date(changedAt);
  if (Number.isNaN(changedDate.getTime())) {
    return { active: false, nextDate: null, daysRemaining: 0 };
  }

  const nextDate = new Date(changedDate.getTime() + USERNAME_COOLDOWN_DAYS * DAY_MS);
  const remainingMs = nextDate.getTime() - Date.now();

  if (remainingMs <= 0) {
    return { active: false, nextDate: nextDate.toISOString().slice(0, 10), daysRemaining: 0 };
  }

  return {
    active: true,
    nextDate: nextDate.toISOString().slice(0, 10),
    daysRemaining: Math.ceil(remainingMs / DAY_MS),
  };
}

function FieldCard({
  children,
  disabled = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <YStack
      width="100%"
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      padding="$3"
      gap="$2"
      opacity={disabled ? 0.58 : 1}
    >
      {children}
    </YStack>
  );
}

export default function EditProfileScreen() {
  const profileQuery = useProfileQuery();
  const saveProfile = useEditProfile();
  const {
    avatarUri,
    isProcessing: isAvatarProcessing,
    takePhoto: takeAvatarPhoto,
    pickAvatar,
    uploadAvatar,
  } = useAvatarPicker();
  const {
    coverUri,
    isProcessing: isCoverProcessing,
    takePhoto: takeCoverPhoto,
    pickCover,
    uploadCover,
  } = useCoverPicker();

  const [photoSheet, setPhotoSheet] = useState<'avatar' | 'cover' | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const form = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      fullName: '',
      displayName: '',
      username: '',
      bio: '',
      isProfessional: false,
    },
    mode: 'onChange',
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (!profile) return;

    form.reset({
      fullName: profile.full_name ?? '',
      displayName: profile.display_name ?? '',
      username: profile.username ?? '',
      bio: profile.bio ?? '',
      isProfessional: Boolean(profile.is_professional),
    });
  }, [form, profile]);

  const values = form.watch();
  const currentUsername = profile?.username?.toLowerCase() ?? '';
  const nextUsername = values.username.trim().toLowerCase();
  const usernameChanged = Boolean(profile) && nextUsername !== currentUsername;
  const usernameStatus = useUsernameAvailability(usernameChanged ? values.username : '');
  const cooldown = useMemo(
    () => getUsernameCooldown(profile?.username_changed_at ?? null),
    [profile?.username_changed_at]
  );
  const isUsernameBlocked = usernameChanged && cooldown.active;
  const isUsernameTaken = usernameChanged && usernameStatus === 'taken';
  const isUsernameChecking = usernameChanged && usernameStatus === 'checking';

  const hasChanges = Boolean(
    profile &&
    (avatarUri ||
      coverUri ||
      values.fullName.trim() !== (profile.full_name ?? '') ||
      (values.displayName.trim() || null) !== profile.display_name ||
      values.username.trim().toLowerCase() !== (profile.username?.toLowerCase() ?? '') ||
      (values.bio.trim() || null) !== profile.bio ||
      values.isProfessional !== Boolean(profile.is_professional))
  );

  const submitDisabled =
    !profile ||
    !hasChanges ||
    !form.formState.isValid ||
    isUsernameBlocked ||
    isUsernameTaken ||
    isUsernameChecking ||
    isAvatarProcessing ||
    isCoverProcessing ||
    saveProfile.isPending;

  const onSubmit = form.handleSubmit(async (formValues) => {
    if (!profile) return;

    if (usernameChanged && cooldown.active) {
      Alert.alert(
        'Username cooldown',
        `You can change your username again on ${cooldown.nextDate}`
      );
      return;
    }

    try {
      await saveProfile.mutateAsync({
        values: formValues,
        currentProfile: profile,
        uploadAvatar,
        uploadCover,
        hasAvatarChange: Boolean(avatarUri),
        hasCoverChange: Boolean(coverUri),
      });

      setToastVisible(true);
      setTimeout(() => {
        router.replace('/profile');
      }, 650);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile update failed.';
      Alert.alert('Could not save profile', message);
    }
  });

  const handleSheetAction = (action: 'camera' | 'gallery') => {
    const target = photoSheet;
    setPhotoSheet(null);

    if (target === 'avatar') {
      void (action === 'camera' ? takeAvatarPhoto() : pickAvatar());
      return;
    }

    if (target === 'cover') {
      void (action === 'camera' ? takeCoverPhoto() : pickCover());
    }
  };

  if (profileQuery.isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
        <Spinner size="large" color="$color" />
      </YStack>
    );
  }

  if (profileQuery.error || !profile) {
    return (
      <YStack flex={1} backgroundColor="$background" padding="$5" justifyContent="center" gap="$3">
        <Text color="$color" fontSize={20} fontWeight="700" textAlign="center">
          Profile unavailable
        </Text>
        <Text color="$placeholderColor" textAlign="center">
          {profileQuery.error instanceof Error
            ? profileQuery.error.message
            : 'Please try again in a moment.'}
        </Text>
        <Button onPress={() => router.back()} backgroundColor="$color" color="$background">
          Go back
        </Button>
      </YStack>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#000000' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        flex={1}
        backgroundColor="$background"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 56,
          paddingBottom: 112,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <YStack width="100%" maxWidth={430} alignSelf="center" gap="$4">
          <XStack alignItems="center" justifyContent="center" height={40} position="relative">
            <YStack
              position="absolute"
              left={0}
              onPress={() => router.back()}
              pressStyle={{ opacity: 0.65 }}
              padding="$1"
            >
              <ChevronLeft size={26} color="#FFFFFF" />
            </YStack>

            <Image
              source={logoSource}
              style={{ width: 34, height: 34, position: 'absolute', left: 42 }}
              contentFit="contain"
              accessibilityLabel="Logo DOUMASSI"
            />

            <Text color="$color" fontSize={19} fontWeight="700" fontFamily="$heading">
              Edit Profile
            </Text>
          </XStack>

          <YStack alignItems="center" gap="$2" marginTop="$1">
            <YStack
              width={104}
              height={104}
              borderRadius={52}
              backgroundColor="$surface"
              borderWidth={1}
              borderColor="$borderColor"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
              position="relative"
            >
              {avatarUri || profile.avatar_url ? (
                <Image
                  source={{ uri: avatarUri ?? profile.avatar_url ?? undefined }}
                  style={{ width: 104, height: 104, borderRadius: 52 }}
                  contentFit="cover"
                />
              ) : (
                <User size={48} color="#A0A0A0" />
              )}

              {isAvatarProcessing ? (
                <YStack
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  backgroundColor="rgba(0,0,0,0.55)"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Spinner color="white" />
                </YStack>
              ) : null}
            </YStack>

            <YStack
              width={30}
              height={30}
              borderRadius={15}
              backgroundColor="$danger"
              alignItems="center"
              justifyContent="center"
              borderWidth={2}
              borderColor="$background"
              marginTop={-34}
              marginLeft={72}
              onPress={() => setPhotoSheet('avatar')}
              pressStyle={{ opacity: 0.8, scale: 0.96 }}
            >
              <Pencil size={14} color="white" />
            </YStack>

            <Text color="$color" fontSize={14} fontWeight="600" marginTop="$1">
              Change Photo
            </Text>
          </YStack>

          <YStack gap="$3">
            <FieldCard>
              <Text color="$placeholderColor" fontSize={12} fontWeight="700">
                Full name
              </Text>
              <Controller
                control={form.control}
                name="fullName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Full name"
                    placeholderTextColor="$placeholderColor"
                    backgroundColor="transparent"
                    borderWidth={0}
                    paddingHorizontal={0}
                    color="$color"
                    fontSize={16}
                  />
                )}
              />
              {form.formState.errors.fullName?.message ? (
                <Text color="$danger" fontSize={11}>
                  {form.formState.errors.fullName.message}
                </Text>
              ) : null}
            </FieldCard>

            <FieldCard>
              <Text color="$placeholderColor" fontSize={12} fontWeight="700">
                Display name
              </Text>
              <Controller
                control={form.control}
                name="displayName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Display name"
                    placeholderTextColor="$placeholderColor"
                    backgroundColor="transparent"
                    borderWidth={0}
                    paddingHorizontal={0}
                    color="$color"
                    fontSize={16}
                  />
                )}
              />
              {form.formState.errors.displayName?.message ? (
                <Text color="$danger" fontSize={11}>
                  {form.formState.errors.displayName.message}
                </Text>
              ) : null}
            </FieldCard>

            <FieldCard>
              <Text color="$placeholderColor" fontSize={12} fontWeight="700">
                Username
              </Text>
              <XStack alignItems="center" gap="$1">
                <Text color="$placeholderColor" fontSize={16}>
                  @
                </Text>
                <Controller
                  control={form.control}
                  name="username"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      flex={1}
                      value={value}
                      onChangeText={(text) => {
                        setUsernameTouched(true);
                        onChange(text);
                      }}
                      onBlur={onBlur}
                      autoCapitalize="none"
                      placeholder="username"
                      placeholderTextColor="$placeholderColor"
                      backgroundColor="transparent"
                      borderWidth={0}
                      paddingHorizontal={0}
                      color="$color"
                      fontSize={16}
                    />
                  )}
                />
              </XStack>
              {form.formState.errors.username?.message ? (
                <Text color="$danger" fontSize={11}>
                  {form.formState.errors.username.message}
                </Text>
              ) : isUsernameBlocked && usernameTouched ? (
                <Text color="$danger" fontSize={11}>
                  You can change your username again on {cooldown.nextDate} (
                  {cooldown.daysRemaining} days remaining)
                </Text>
              ) : isUsernameChecking ? (
                <Text color="$placeholderColor" fontSize={11}>
                  Checking username...
                </Text>
              ) : isUsernameTaken ? (
                <Text color="$danger" fontSize={11}>
                  This username is already taken
                </Text>
              ) : usernameChanged && usernameStatus === 'available' ? (
                <Text color="$accentNeon" fontSize={11}>
                  Username available
                </Text>
              ) : null}
            </FieldCard>

            <FieldCard>
              <XStack justifyContent="space-between" alignItems="center">
                <Text color="$placeholderColor" fontSize={12} fontWeight="700">
                  Bio
                </Text>
                <Text color="$placeholderColor" fontSize={11}>
                  {values.bio.length}/250
                </Text>
              </XStack>
              <Controller
                control={form.control}
                name="bio"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextArea
                    value={value}
                    onChangeText={(text) => onChange(text.slice(0, 250))}
                    onBlur={onBlur}
                    placeholder="Bio"
                    placeholderTextColor="$placeholderColor"
                    maxLength={250}
                    minHeight={92}
                    textAlignVertical="top"
                    backgroundColor="transparent"
                    borderWidth={0}
                    paddingHorizontal={0}
                    color="$color"
                    fontSize={15}
                  />
                )}
              />
            </FieldCard>

            <FieldCard disabled>
              <Text color="$placeholderColor" fontSize={12} fontWeight="700">
                Birthday
              </Text>
              <Text color="$color" fontSize={16}>
                {formatDate(profile.birthday)}
              </Text>
              <Text color="$placeholderColor" fontSize={11} lineHeight={16}>
                Birthday cannot be changed. Contact support if needed.
              </Text>
            </FieldCard>

            <FieldCard disabled>
              <Text color="$placeholderColor" fontSize={12} fontWeight="700">
                Email
              </Text>
              <Text color="$color" fontSize={16}>
                {profile.email ?? 'Not set'}
              </Text>
            </FieldCard>
          </YStack>

          <YStack gap="$2" marginTop="$2">
            <Text color="$color" fontSize={16} fontWeight="700">
              Cover photo
            </Text>
            <YStack
              width="100%"
              aspectRatio={3}
              borderRadius="$4"
              backgroundColor="$surface"
              borderWidth={1}
              borderColor="$borderColor"
              overflow="hidden"
              alignItems="center"
              justifyContent="center"
            >
              {coverUri || profile.cover_url ? (
                <Image
                  source={{ uri: coverUri ?? profile.cover_url ?? undefined }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <ImageIcon size={34} color="#A0A0A0" />
              )}

              {isCoverProcessing ? (
                <YStack
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  backgroundColor="rgba(0,0,0,0.55)"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Spinner color="white" size="large" />
                </YStack>
              ) : null}
            </YStack>
            <Button
              onPress={() => setPhotoSheet('cover')}
              backgroundColor="$surface"
              borderColor="$borderColor"
              borderWidth={1}
              color="$color"
              borderRadius="$4"
              height={44}
              fontWeight="700"
              pressStyle={{ opacity: 0.85, scale: 0.98 }}
            >
              Change cover
            </Button>
          </YStack>

          <XStack
            alignItems="center"
            justifyContent="space-between"
            backgroundColor="$surface"
            borderWidth={1}
            borderColor="$borderColor"
            borderRadius="$4"
            padding="$3"
          >
            <YStack gap="$1" flex={1} paddingRight="$3">
              <Text color="$color" fontSize={15} fontWeight="700">
                Professional account
              </Text>
              <Text color="$placeholderColor" fontSize={12} lineHeight={16}>
                Show your profile as a professional account.
              </Text>
            </YStack>
            <Controller
              control={form.control}
              name="isProfessional"
              render={({ field: { onChange, value } }) => (
                <Switch
                  size="$3"
                  checked={value}
                  onCheckedChange={onChange}
                  backgroundColor={value ? '$accentNeon' : '$surfaceElevated'}
                  borderWidth={1}
                  borderColor="$borderColor"
                >
                  <Switch.Thumb animation="quick" backgroundColor="white" />
                </Switch>
              )}
            />
          </XStack>
        </YStack>
      </ScrollView>

      <YStack
        position="absolute"
        left={0}
        right={0}
        bottom={0}
        paddingHorizontal={20}
        paddingTop="$3"
        paddingBottom={Platform.OS === 'ios' ? 32 : 20}
        backgroundColor="rgba(0,0,0,0.94)"
        borderTopWidth={1}
        borderTopColor="$borderColor"
      >
        <Button
          onPress={onSubmit}
          disabled={submitDisabled}
          backgroundColor="$color"
          color="$background"
          borderRadius="$4"
          height={50}
          fontWeight="800"
          fontSize={16}
          opacity={submitDisabled ? 0.45 : 1}
          pressStyle={{ opacity: 0.85, scale: 0.98 }}
        >
          {saveProfile.isPending ? <Spinner color="$background" /> : 'Save'}
        </Button>
      </YStack>

      {toastVisible ? (
        <YStack
          position="absolute"
          bottom={96}
          alignSelf="center"
          backgroundColor="$surfaceElevated"
          borderWidth={1}
          borderColor="$accentNeon"
          borderRadius="$4"
          paddingHorizontal="$4"
          paddingVertical="$2"
        >
          <Text color="$color" fontSize={13} fontWeight="700">
            Profile saved
          </Text>
        </YStack>
      ) : null}

      <Sheet
        modal
        open={photoSheet !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setPhotoSheet(null);
        }}
        snapPoints={[25]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay />
        <Sheet.Frame padding="$4" gap="$3" backgroundColor="$surface">
          <Sheet.Handle />
          <Button
            icon={<Camera size={20} color="white" />}
            justifyContent="flex-start"
            backgroundColor="transparent"
            color="$color"
            onPress={() => handleSheetAction('camera')}
          >
            Take a photo
          </Button>
          <Button
            icon={<ImageIcon size={20} color="white" />}
            justifyContent="flex-start"
            backgroundColor="transparent"
            color="$color"
            onPress={() => handleSheetAction('gallery')}
          >
            Choose from gallery
          </Button>
        </Sheet.Frame>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
