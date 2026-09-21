// VoiceRecordingBar — E5-12
//
// Remplace la barre de saisie pendant l'enregistrement/la transcription vocale.
// Affiche un indicateur animé (équaliseur), le chrono, un bouton Annuler et un
// bouton Stop. Rendu uniquement sur natif (le micro est masqué sur web).

import { Square } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { Spinner, Text, XStack } from 'tamagui';

const REC_COLOR = '#FF3B30';
const BAR_COUNT = 4;

/** Petit équaliseur animé (barres qui oscillent) — signale « ça enregistre ». */
function RecordingWave() {
  const values = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.4))).current;

  useEffect(() => {
    const animations = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(v, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.4,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [values]);

  return (
    <XStack alignItems="center" gap={3} height={20}>
      {values.map((v, i) => (
        <Animated.View key={i} style={[styles.bar, { transform: [{ scaleY: v }] }]} />
      ))}
    </XStack>
  );
}

export interface VoiceRecordingBarProps {
  isTranscribing: boolean;
  durationLabel: string;
  recordingLabel: string;
  transcribingLabel: string;
  cancelLabel: string;
  cancelA11y: string;
  stopA11y: string;
  onCancel: () => void;
  onStop: () => void;
}

export function VoiceRecordingBar({
  isTranscribing,
  durationLabel,
  recordingLabel,
  transcribingLabel,
  cancelLabel,
  cancelA11y,
  stopA11y,
  onCancel,
  onStop,
}: VoiceRecordingBarProps) {
  if (isTranscribing) {
    return (
      <XStack flex={1} alignItems="center" justifyContent="center" gap={10} height={44}>
        <Spinner size="small" color="$color" />
        <Text fontSize={14} color="$textSecondary" fontWeight="600">
          {transcribingLabel}
        </Text>
      </XStack>
    );
  }

  return (
    <XStack flex={1} alignItems="center" gap={10} height={44}>
      {/* Annuler */}
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={cancelA11y}
        hitSlop={8}
        style={styles.cancelButton}
      >
        <Text fontSize={14} color="$textSecondary" fontWeight="600">
          {cancelLabel}
        </Text>
      </Pressable>

      {/* Indicateur + libellé + chrono */}
      <XStack flex={1} alignItems="center" gap={10}>
        <RecordingWave />
        <Text fontSize={14} color="$color" fontWeight="600">
          {recordingLabel}
        </Text>
        <Text fontSize={14} color="$textSecondary" fontVariant={['tabular-nums']}>
          {durationLabel}
        </Text>
      </XStack>

      {/* Stop → transcription */}
      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel={stopA11y}
        style={styles.stopButton}
      >
        <Square size={16} color="#000000" fill="#000000" />
      </Pressable>
    </XStack>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: REC_COLOR,
  },
  cancelButton: {
    paddingHorizontal: 6,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
