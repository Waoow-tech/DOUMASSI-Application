// CallEntry — Ticket #234 (E6-C5).
//
// Rend une entrée discrète dans la liste de messages pour signaler un appel
// passé : "📞 Appel audio · 2min 34s" ou "📞 Appel manqué" etc.
//
// Tap sur l'entrée → callback `onRecall` pour relancer un appel du même type.

import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, Video } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

import type { CallEntryRow } from '../hooks/useConversationCalls';

const COLORS = {
  background: '#1A1A1A',
  text: '#FFFFFF',
  textMuted: '#A0A0A0',
  iconNormal: '#FFFFFF',
  iconMissed: '#FF3B30',
};

function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const totalSec = Math.floor((end - start) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}min ${s.toString().padStart(2, '0')}s`;
}

export interface CallEntryProps {
  call: CallEntryRow;
  /** Vrai si c'est moi qui ai lancé l'appel (= sortant). */
  isMine: boolean;
  /** Tap → relance un appel du même type. */
  onRecall?: (callType: 'audio' | 'video') => void;
}

function CallEntryComponent({ call, isMine, onRecall }: CallEntryProps) {
  const t = useTranslations();
  const duration = formatDuration(call.started_at, call.ended_at);
  const entry = t.messaging.calls.entry;

  let icon: React.ReactNode;
  let label: string;
  if (call.status === 'missed') {
    icon = <PhoneMissed size={16} color={COLORS.iconMissed} />;
    label = isMine ? entry.noAnswer : entry.missed;
  } else if (call.status === 'rejected') {
    icon = <PhoneOff size={16} color={COLORS.iconMissed} />;
    label = isMine ? entry.rejectedByRecipient : entry.rejected;
  } else if (call.status === 'cancelled') {
    icon = <PhoneOff size={16} color={COLORS.textMuted} />;
    label = entry.cancelled;
  } else {
    // ended
    icon = isMine ? (
      <Phone size={16} color={COLORS.iconNormal} />
    ) : (
      <PhoneIncoming size={16} color={COLORS.iconNormal} />
    );
    label = call.call_type === 'video' ? entry.videoCall : entry.audioCall;
  }

  const callTypeIcon =
    call.call_type === 'video' ? (
      <Video size={12} color={COLORS.textMuted} />
    ) : (
      <Phone size={12} color={COLORS.textMuted} />
    );

  return (
    <Pressable
      onPress={() => onRecall?.(call.call_type)}
      accessibilityRole="button"
      accessibilityLabel={`${label}${duration ? ` — ${duration}` : ''}. ${entry.tapToRecall}`}
      style={styles.pressable}
    >
      <XStack
        backgroundColor={COLORS.background}
        borderRadius={9999}
        paddingHorizontal={14}
        paddingVertical={8}
        alignItems="center"
        gap={8}
        maxWidth="78%"
      >
        {icon}
        <YStack flex={1} minWidth={0}>
          <Text color={COLORS.text} fontSize={13} fontWeight="600" numberOfLines={1}>
            {label}
          </Text>
          {duration ? (
            <XStack alignItems="center" gap={4} marginTop={1}>
              {callTypeIcon}
              <Text color={COLORS.textMuted} fontSize={11}>
                {duration}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </XStack>
    </Pressable>
  );
}

export const CallEntry = memo(CallEntryComponent);

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
});
