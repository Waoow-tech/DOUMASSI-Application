// Onboarding step 2/2 — Add a cover photo.
// Bannière paysage 3:1, format recommandé 1500×500px.
// Dernière étape de l'onboarding : "Finish setup" et "Skip for now" passent
// tous les deux `onboarding_completed = true` avant de rediriger vers /feed.
//
// Ticket E2-10 — Sprint 1 Auth & Onboarding.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Camera, ImageIcon } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Button, ScrollView, Sheet, Spinner, Text, XStack, YStack } from 'tamagui';

import { useCoverPicker } from '@/features/auth/hooks/useCoverPicker';
import { useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const logoSource = require('../../assets/Logo-Doumassi.webp') as number;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CoverPhotoScreen() {
  const router = useRouter();
  const { coverUri, isProcessing, takePhoto, pickCover, uploadCover } = useCoverPicker();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);

  const t = useTranslations();
  const copy = t.auth.coverPhoto;

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  /**
   * Marque l'onboarding comme terminé et redirige sur /feed. Optionnellement,
   * met à jour `cover_url` si un cover a été uploaded (cas "Finish setup").
   * Le cas "Skip for now" appelle cette fonction sans uploader.
   */
  const finalizeOnboarding = async (coverUrl: string | null) => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const updates: Record<string, unknown> = {
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };
      // On n'écrase cover_url que si on a effectivement un upload réussi
      if (coverUrl) updates.cover_url = coverUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (updateError) throw updateError;

      logger.info('Onboarding finalized', { hasCover: Boolean(coverUrl) });
      router.replace('/feed');
    } catch (err: unknown) {
      logger.error('Finalize onboarding failed', err);
      const message = err instanceof Error ? err.message : copy.errorGeneric;
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  const handleFinishSetup = async () => {
    let coverUrl: string | null = null;

    if (coverUri) {
      // Upload puis finaliser
      setIsLoading(true);
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        const uploaded = await uploadCover(user.id);
        coverUrl = uploaded ?? null;
      } catch (err: unknown) {
        logger.error('Cover upload before finalize failed', err);
        const message = err instanceof Error ? err.message : copy.errorGeneric;
        setError(message);
        setIsLoading(false);
        return;
      }
    }

    await finalizeOnboarding(coverUrl);
  };

  /**
   * Skip volontaire — finalize sans uploader le cover. L'user pourra ajouter
   * une bannière plus tard depuis /settings (à venir).
   */
  const handleSkip = () => {
    void finalizeOnboarding(null);
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

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
            {copy.title}
          </Text>

          {/* ── Progress bar 2/2 (both filled) ── */}
          <XStack width="100%" alignItems="center" gap="$2">
            <YStack flex={1} height={3} borderRadius={2} backgroundColor="$color" />
            <YStack flex={1} height={3} borderRadius={2} backgroundColor="$color" />
          </XStack>

          {/* ── Subtitle ── */}
          <Text fontSize={14} color="$placeholderColor" textAlign="center" lineHeight={20}>
            {copy.subtitle}
          </Text>

          {/* ── Cover upload zone ── */}
          <YStack
            width="100%"
            aspectRatio={3}
            backgroundColor="$surface"
            borderRadius="$4"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
            onPress={() => setShowPhotoSheet(true)}
            pressStyle={{ opacity: 0.85 }}
            cursor="pointer"
            marginTop="$2"
          >
            {coverUri ? (
              <Image
                source={{ uri: coverUri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                accessibilityLabel="Cover photo sélectionnée"
              />
            ) : (
              <Camera size={36} color="#A0A0A0" />
            )}

            {isProcessing && (
              <YStack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                backgroundColor="rgba(0,0,0,0.5)"
                alignItems="center"
                justifyContent="center"
              >
                <Spinner color="white" size="large" />
              </YStack>
            )}
          </YStack>

          {/* ── Hint ── */}
          <Text
            fontSize={12}
            color="$placeholderColor"
            textAlign="center"
            lineHeight={18}
            paddingHorizontal="$2"
          >
            {coverUri ? copy.changeHint : copy.hint}
          </Text>

          {/* ── Error ── */}
          {error ? (
            <Text fontSize={13} color="$danger" textAlign="center">
              {error}
            </Text>
          ) : null}

          {/* ── Finish setup ── */}
          <Button
            id="cover-photo-finish-button"
            onPress={handleFinishSetup}
            disabled={isLoading || isProcessing}
            backgroundColor="$color"
            color="$background"
            borderRadius="$4"
            height={48}
            fontWeight="700"
            fontSize={16}
            width="100%"
            pressStyle={{ opacity: 0.85, scale: 0.98 }}
            marginTop="$2"
            opacity={isLoading || isProcessing ? 0.5 : 1}
          >
            {isLoading ? <Spinner size="small" color="$background" /> : copy.finishSetup}
          </Button>

          {/* ── Skip for now ── */}
          <Button
            id="cover-photo-skip-button"
            onPress={handleSkip}
            disabled={isLoading}
            backgroundColor="transparent"
            color="$placeholderColor"
            fontWeight="600"
            fontSize={14}
            pressStyle={{ opacity: 0.7 }}
          >
            {copy.skipForNow}
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
            id="cover-photo-take-button"
            icon={<Camera size={20} color="white" />}
            justifyContent="flex-start"
            backgroundColor="transparent"
            color="$color"
            onPress={() => {
              setShowPhotoSheet(false);
              void takePhoto();
            }}
          >
            {copy.takePhoto}
          </Button>
          <Button
            id="cover-photo-gallery-button"
            icon={<ImageIcon size={20} color="white" />}
            justifyContent="flex-start"
            backgroundColor="transparent"
            color="$color"
            onPress={() => {
              setShowPhotoSheet(false);
              void pickCover();
            }}
          >
            {copy.chooseFromGallery}
          </Button>
        </Sheet.Frame>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
