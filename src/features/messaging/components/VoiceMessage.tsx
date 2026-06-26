// VoiceMessage — Ticket #211 (Sprint 6).
//
// Bloc audio rendu DANS un MessageBubble quand attachment_type='voice'.
// MVP minimaliste : bouton Play/Pause + durée. Pas de waveform, pas de scrub
// (déférés post-bêta).
//
// 1 player par bulle. expo-audio gère le cycle de vie via les hooks. Ce n'est
// pas optimal en RAM si une conversation a 100 voicemails (100 players) mais
// suffisant pour la bêta. Optim future : un player global partagé avec switch
// de source.

import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

export interface VoiceMessageProps {
  /** URL publique du fichier .m4a uploadé. */
  audioUrl: string;
  /** Durée en secondes (récupérée à l'enregistrement, stockée dans content). */
  durationSeconds?: number;
  /** Couleur du texte selon la bulle (mine = noir, other = blanc). */
  textColor: string;
  /** Couleur de l'icône Play/Pause. */
  iconColor: string;
}

function formatMmSs(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function VoiceMessageComponent({
  audioUrl,
  durationSeconds,
  textColor,
  iconColor,
}: VoiceMessageProps) {
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status?.playing ?? false;
  const currentTime = status?.currentTime ?? 0;
  const totalDuration = durationSeconds ?? status?.duration ?? 0;
  const remaining = Math.max(0, totalDuration - currentTime);

  const handleToggle = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      // Si on a atteint la fin, on rejoue depuis 0
      if (totalDuration > 0 && currentTime >= totalDuration - 0.2) {
        player.seekTo(0);
      }
      player.play();
    }
  }, [currentTime, isPlaying, player, totalDuration]);

  return (
    <XStack alignItems="center" gap={10} minWidth={180}>
      <Pressable
        onPress={handleToggle}
        style={[styles.playButton, { borderColor: iconColor }]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Mettre en pause' : 'Lire le message vocal'}
      >
        {isPlaying ? (
          <Pause size={18} color={iconColor} fill={iconColor} />
        ) : (
          <Play size={18} color={iconColor} fill={iconColor} />
        )}
      </Pressable>

      <YStack flex={1} gap={2}>
        {/* Pseudo-waveform : 5 barres décoratives sans amplitude réelle. */}
        <XStack alignItems="center" gap={2} height={14}>
          {[6, 10, 14, 8, 12, 9, 11, 7, 13, 8].map((h, i) => (
            <YStack
              key={`b-${i}`}
              width={2}
              height={h}
              borderRadius={1}
              backgroundColor={iconColor}
              opacity={0.7}
            />
          ))}
        </XStack>
        <Text fontSize={11} color={textColor}>
          {isPlaying ? formatMmSs(remaining) : formatMmSs(totalDuration)}
        </Text>
      </YStack>
    </XStack>
  );
}

export const VoiceMessage = memo(VoiceMessageComponent);

const styles = StyleSheet.create({
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
