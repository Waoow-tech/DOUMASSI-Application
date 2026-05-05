// Onboarding step 1/2 — Complete your profile.
// Avatar (camera / gallery), Gender pills, Bio, Professional toggle.
// Ticket E2-09 — Sprint 1 Auth & Onboarding.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Camera, ImageIcon, Plus, User } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import {
  Button,
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
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const logoSource = require('../../assets/Logo-Doumassi.png') as number;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Gender = 'male' | 'female' | 'other';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { avatarUri, isProcessing, takePhoto, pickAvatar, uploadAvatar } = useAvatarPicker();

  const [gender, setGender] = useState<Gender | null>(null);
  const [bio, setBio] = useState('');
  const [isProfessional, setIsProfessional] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  // -----------------------------------------------------------------------
  // Submission
  // -----------------------------------------------------------------------

  const handleContinue = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Upload avatar if one was picked
      let avatarUrl: string | undefined;
      if (avatarUri) {
        avatarUrl = await uploadAvatar(user.id);
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: avatarUrl ?? null,
          gender,
          bio: bio.trim() || null,
          is_professional: isProfessional,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      router.push('/(onboarding)/cover-photo');
    } catch (err: any) {
      logger.error('Profile update failed', err);
      setError(err.message ?? 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/(onboarding)/cover-photo');
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <YStack gap="$3" alignItems="center" maxWidth={400} width="100%" alignSelf="center">
          {/* ── Logo ── */}
          <YStack alignItems="center" justifyContent="center">
            <Image
              source={logoSource}
              style={{ width: 48, height: 48 }}
              contentFit="contain"
              accessibilityLabel="Logo DOUMASSI"
            />
          </YStack>

          {/* ── Title ── */}
          <Text
            fontSize={26}
            fontWeight="700"
            color="$color"
            textAlign="center"
            fontFamily="$heading"
          >
            Complete your profile
          </Text>

          {/* ── Progress bar 1/2 ── */}
          <XStack width="100%" alignItems="center" gap="$2">
            <YStack flex={1} height={3} borderRadius={2} backgroundColor="$color" />
            <YStack flex={1} height={3} borderRadius={2} backgroundColor="$borderColor" />
          </XStack>

          {/* ── Subtitle ── */}
          <Text fontSize={14} color="$placeholderColor" textAlign="center" lineHeight={20}>
            Help others recognize you on{'\n'}DOUMASSI.
          </Text>

          {/* ── Avatar ── */}
          <YStack alignItems="center" gap="$2">
            <YStack
              width={100}
              height={100}
              borderRadius={50}
              backgroundColor="$surface"
              alignItems="center"
              justifyContent="center"
              position="relative"
              onPress={() => setShowPhotoSheet(true)}
              pressStyle={{ opacity: 0.8 }}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                  contentFit="cover"
                />
              ) : (
                <User size={48} color="#A0A0A0" />
              )}

              {isProcessing && (
                <YStack
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  backgroundColor="rgba(0,0,0,0.5)"
                  borderRadius={50}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Spinner color="white" />
                </YStack>
              )}

              {/* Red "+" badge */}
              <YStack
                position="absolute"
                bottom={0}
                right={0}
                backgroundColor="$danger"
                width={28}
                height={28}
                borderRadius={14}
                alignItems="center"
                justifyContent="center"
                borderWidth={2}
                borderColor="$background"
              >
                <Plus size={14} color="white" />
              </YStack>
            </YStack>

            <Text fontSize={13} color="$placeholderColor">
              Add a profile picture
            </Text>
          </YStack>

          {/* ── Gender (optional) ── */}
          <YStack width="100%" gap="$2">
            <Text fontSize={14} color="$placeholderColor">
              Gender (optional)
            </Text>
            <XStack gap="$3">
              {(['male', 'female', 'other'] as Gender[]).map((g) => {
                const isActive = gender === g;
                return (
                  <Button
                    key={g}
                    flex={1}
                    height={40}
                    backgroundColor={isActive ? 'white' : 'transparent'}
                    borderWidth={1}
                    borderColor={isActive ? 'white' : '$borderColor'}
                    borderRadius="$full"
                    onPress={() => setGender(isActive ? null : g)}
                    pressStyle={{ opacity: 0.8 }}
                  >
                    <Text
                      color={isActive ? 'black' : 'white'}
                      fontSize={14}
                      fontWeight="600"
                      textTransform="capitalize"
                    >
                      {g}
                    </Text>
                  </Button>
                );
              })}
            </XStack>
          </YStack>

          {/* ── Bio (optional) ── */}
          <YStack width="100%" gap="$1">
            <TextArea
              placeholder="Bio (optional)"
              placeholderTextColor="$placeholderColor"
              value={bio}
              onChangeText={(text) => setBio(text.slice(0, 250))}
              height={80}
              maxLength={250}
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius="$4"
              backgroundColor="transparent"
              color="$color"
              textAlignVertical="top"
              padding="$3"
            />
          </YStack>

          {/* ── Professional account ── */}
          <YStack width="100%" gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={14} color="$placeholderColor">
                Professional account
              </Text>
              <Switch
                size="$3"
                checked={isProfessional}
                onCheckedChange={setIsProfessional}
                backgroundColor={isProfessional ? '$accentNeon' : '$surface'}
                borderWidth={1}
                borderColor="$borderColor"
              >
                <Switch.Thumb animation="quick" backgroundColor="white" />
              </Switch>
            </XStack>
            <Text fontSize={12} color="$placeholderColor" lineHeight={16}>
              Your account can be used to promote content and products related to your profession.
            </Text>
          </YStack>

          {/* ── Error ── */}
          {error && (
            <Text color="$danger" textAlign="center" fontSize={13}>
              {error}
            </Text>
          )}

          {/* ── Continue ── */}
          <Button
            onPress={handleContinue}
            disabled={isLoading || isProcessing}
            backgroundColor="$color"
            color="$background"
            borderRadius="$4"
            height={48}
            fontWeight="700"
            fontSize={16}
            width="100%"
            pressStyle={{ opacity: 0.85, scale: 0.98 }}
          >
            {isLoading ? <Spinner color="$background" /> : 'Continue'}
          </Button>

          {/* ── Skip ── */}
          <Button
            onPress={handleSkip}
            backgroundColor="transparent"
            color="$info"
            fontWeight="600"
            fontSize={14}
            pressStyle={{ opacity: 0.7 }}
          >
            Skip for now
          </Button>
        </YStack>
      </ScrollView>

      {/* ── Photo options bottom sheet ── */}
      <Sheet
        modal
        open={showPhotoSheet}
        onOpenChange={setShowPhotoSheet}
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
            onPress={() => {
              setShowPhotoSheet(false);
              takePhoto();
            }}
          >
            Take a photo
          </Button>
          <Button
            icon={<ImageIcon size={20} color="white" />}
            justifyContent="flex-start"
            backgroundColor="transparent"
            color="$color"
            onPress={() => {
              setShowPhotoSheet(false);
              pickAvatar();
            }}
          >
            Choose from gallery
          </Button>
        </Sheet.Frame>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
