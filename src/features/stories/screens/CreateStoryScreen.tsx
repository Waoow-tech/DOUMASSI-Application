// Écran « Créer une story » — E4-12.
// Capture photo (tap) ou vidéo 15s max (appui long) via expo-camera.
// Galerie via expo-image-picker. Preview avant publication. Upload via
// uploadStoryMedia → INSERT dans stories. Modale full-screen.

import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useNavigation } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { CameraIcon, FlipHorizontal, ImageIcon, RefreshCw } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, XStack, YStack } from 'tamagui';

import { useCreateStory } from '@/features/stories/hooks/useCreateStory';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const BRAND_GREEN = '#10D970';
const MAX_VIDEO_SECS = 15;

type CameraMode = 'image' | 'video';
type CameraFacing = 'front' | 'back';

interface CapturedAsset {
  uri: string;
  type: CameraMode;
  durationSeconds?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function CreateStoryScreen() {
  const navigation = useNavigation();
  const createStory = useCreateStory();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [mode, setMode] = useState<CameraMode>('image');
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [timerSecs, setTimerSecs] = useState(0);
  const [capturedAsset, setCapturedAsset] = useState<CapturedAsset | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef(0);

  // Demande les permissions au premier montage
  useEffect(() => {
    void requestCameraPermission();
    void requestMicPermission();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop l'enregistrement si l'écran est quitté avant la fin
  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      if (isRecording) cameraRef.current?.stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    });
  }, [navigation, isRecording]);

  // Cleanup timer au démontage
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Lecteur vidéo pour la preview (null si pas de vidéo)
  const videoPlayer = useVideoPlayer(
    capturedAsset?.type === 'video' ? capturedAsset.uri : null,
    (player) => {
      player.loop = true;
    }
  );

  useEffect(() => {
    if (capturedAsset?.type === 'video') {
      videoPlayer.play();
    }
  }, [capturedAsset, videoPlayer]);

  // -------------------------------------------------------------------------
  // Timer helpers
  // -------------------------------------------------------------------------

  const startTimer = () => {
    setTimerSecs(0);
    recordStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordStartRef.current) / 1000);
      setTimerSecs(Math.min(elapsed, MAX_VIDEO_SECS));
      if (elapsed >= MAX_VIDEO_SECS && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, 500);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // -------------------------------------------------------------------------
  // Capture
  // -------------------------------------------------------------------------

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo?.uri) setCapturedAsset({ uri: photo.uri, type: 'image' });
    } catch {
      // Ignore — peut arriver si l'écran est en cours de transition
    }
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    setIsRecording(true);
    startTimer();
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: MAX_VIDEO_SECS });
      if (result?.uri) {
        const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        setCapturedAsset({ uri: result.uri, type: 'video', durationSeconds: duration });
      }
    } catch {
      // Arrêt normal via stopRecording() — pas une vraie erreur
    } finally {
      setIsRecording(false);
      stopTimer();
      setTimerSecs(0);
    }
  };

  const handlePressOut = () => {
    if (mode === 'video' && isRecording) {
      cameraRef.current?.stopRecording();
    }
  };

  // -------------------------------------------------------------------------
  // Galerie
  // -------------------------------------------------------------------------

  const handlePickFromGallery = async () => {
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission refusée', "Activez l'accès aux photos dans les Réglages.");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mode === 'image' ? ['images'] : ['videos'],
        videoMaxDuration: MAX_VIDEO_SECS,
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      if (asset.type === 'video') {
        const duration = asset.duration ? Math.round(asset.duration / 1000) : undefined;
        setCapturedAsset({ uri: asset.uri, type: 'video', durationSeconds: duration });
      } else {
        setCapturedAsset({ uri: asset.uri, type: 'image' });
      }
    } catch {
      // Ignore
    }
  };

  // -------------------------------------------------------------------------
  // Publication
  // -------------------------------------------------------------------------

  const handlePublish = () => {
    if (!capturedAsset || createStory.isPending) return;
    createStory.mutate(
      {
        uri: capturedAsset.uri,
        mediaType: capturedAsset.type,
        durationSeconds: capturedAsset.durationSeconds,
      },
      { onSuccess: () => router.back() }
    );
  };

  const handleRetake = () => {
    setCapturedAsset(null);
    createStory.reset();
  };

  // -------------------------------------------------------------------------
  // États de permission
  // -------------------------------------------------------------------------

  if (!cameraPermission || !micPermission) {
    return <YStack flex={1} backgroundColor="#000000" />;
  }

  if (!cameraPermission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          gap="$4"
          paddingHorizontal="$5"
        >
          <Text color="$color" textAlign="center" fontSize={16}>
            Activez l&apos;accès à la caméra dans les Réglages pour utiliser les stories.
          </Text>
          <Button onPress={() => router.back()} backgroundColor="$backgroundFocus" color="$color">
            Retour
          </Button>
        </YStack>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  if (capturedAsset) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <YStack flex={1} backgroundColor="#000000">
          {/* Média plein écran */}
          {capturedAsset.type === 'image' ? (
            <Image
              source={{ uri: capturedAsset.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <VideoView
              player={videoPlayer}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          )}

          {/* Boutons bas */}
          <XStack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            paddingHorizontal="$5"
            paddingBottom="$6"
            paddingTop="$3"
            justifyContent="space-between"
            alignItems="center"
          >
            <Button
              onPress={handleRetake}
              disabled={createStory.isPending}
              opacity={createStory.isPending ? 0.5 : 1}
              backgroundColor="rgba(0,0,0,0.6)"
              color="#FFFFFF"
              borderWidth={1}
              borderColor="rgba(255,255,255,0.3)"
              size="$4"
              borderRadius="$10"
              icon={<RefreshCw size={16} color="#FFFFFF" />}
            >
              Recommencer
            </Button>

            <Button
              onPress={handlePublish}
              disabled={createStory.isPending}
              backgroundColor={createStory.isPending ? '$backgroundFocus' : BRAND_GREEN}
              color={createStory.isPending ? '$color' : '#000000'}
              opacity={createStory.isPending ? 0.7 : 1}
              size="$4"
              borderRadius="$10"
              paddingHorizontal="$5"
            >
              {createStory.isPending ? <ActivityIndicator color="#000000" /> : 'Publier'}
            </Button>
          </XStack>

          {/* Overlay de blocage pendant la publication */}
          {createStory.isPending ? (
            <YStack
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(0,0,0,0.35)"
            />
          ) : null}

          {/* Erreur */}
          {createStory.isError ? (
            <YStack
              position="absolute"
              bottom={120}
              left="$4"
              right="$4"
              backgroundColor="rgba(239,68,68,0.9)"
              borderRadius="$3"
              paddingVertical="$2"
              paddingHorizontal="$3"
            >
              <Text color="#FFFFFF" fontSize={13} textAlign="center">
                {createStory.error?.message ?? 'Erreur lors de la publication.'}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Caméra
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <YStack flex={1} backgroundColor="#000000">
        <CameraView
          ref={cameraRef}
          facing={facing}
          mode={mode === 'video' ? 'video' : 'picture'}
          style={StyleSheet.absoluteFill}
        >
          {/* Header : toggle mode + flip */}
          <XStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            paddingHorizontal="$4"
            paddingTop="$3"
            paddingBottom="$2"
            alignItems="center"
            justifyContent="space-between"
          >
            {/* Bouton fermer */}
            <YStack onPress={() => router.back()} padding="$2" pressStyle={{ opacity: 0.6 }}>
              <Text color="#FFFFFF" fontSize={22} fontWeight="700">
                ✕
              </Text>
            </YStack>

            {/* Toggle Photo / Vidéo */}
            <XStack backgroundColor="rgba(0,0,0,0.5)" borderRadius="$10" padding={4} gap={2}>
              {(['image', 'video'] as CameraMode[]).map((m) => (
                <YStack
                  key={m}
                  onPress={() => setMode(m)}
                  backgroundColor={mode === m ? BRAND_GREEN : 'transparent'}
                  borderRadius="$10"
                  paddingHorizontal="$3"
                  paddingVertical="$1"
                  pressStyle={{ opacity: 0.7 }}
                >
                  <Text color={mode === m ? '#000000' : '#FFFFFF'} fontSize={13} fontWeight="600">
                    {m === 'image' ? 'Photo' : 'Vidéo'}
                  </Text>
                </YStack>
              ))}
            </XStack>

            {/* Flip caméra */}
            <YStack
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              padding="$2"
              pressStyle={{ opacity: 0.6 }}
            >
              <FlipHorizontal size={26} color="#FFFFFF" />
            </YStack>
          </XStack>

          {/* Timer d'enregistrement */}
          {isRecording ? (
            <YStack
              position="absolute"
              top={80}
              alignSelf="center"
              backgroundColor="rgba(239,68,68,0.85)"
              borderRadius="$10"
              paddingHorizontal="$3"
              paddingVertical={4}
            >
              <Text color="#FFFFFF" fontSize={15} fontWeight="700">
                ⏺ {formatTimer(timerSecs)}
              </Text>
            </YStack>
          ) : null}

          {/* Contrôles bas : galerie | capture | spacer */}
          <XStack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            paddingHorizontal="$5"
            paddingBottom="$8"
            paddingTop="$3"
            alignItems="center"
            justifyContent="space-between"
          >
            {/* Galerie */}
            <YStack
              onPress={() => void handlePickFromGallery()}
              padding="$3"
              pressStyle={{ opacity: 0.6 }}
            >
              <ImageIcon size={30} color="#FFFFFF" />
            </YStack>

            {/* Bouton capture */}
            <Pressable
              onPress={mode === 'image' ? () => void handleTakePhoto() : undefined}
              onLongPress={mode === 'video' ? () => void handleStartRecording() : undefined}
              onPressOut={handlePressOut}
              delayLongPress={200}
            >
              <YStack
                width={72}
                height={72}
                borderRadius={36}
                backgroundColor={isRecording ? '#EF4444' : '#FFFFFF'}
                borderWidth={4}
                borderColor={isRecording ? '#FF8888' : 'rgba(255,255,255,0.5)'}
                alignItems="center"
                justifyContent="center"
              >
                {mode === 'video' && !isRecording ? (
                  <YStack width={28} height={28} borderRadius={14} backgroundColor="#EF4444" />
                ) : mode === 'image' ? (
                  <CameraIcon size={28} color="#000000" />
                ) : null}
              </YStack>
            </Pressable>

            {/* Spacer symétrique à gauche */}
            <YStack width={54} />
          </XStack>
        </CameraView>
      </YStack>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles statiques
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
});
