// IncomingCallScreen — Ticket #233 (E6-C4).
//
// Plein écran ringtone. Affiche l'avatar + le nom du caller + Accept (vert)
// / Decline (rouge). Auto-timeout à 30s → status='missed'.
//
// Pour MVP : pas de son ringtone (à ajouter follow-up si gros besoin UX).
// Vibration nope non plus — éviter de demander une perm de plus pour MVP.
//
// Pour générer un token client : on rappelle l'Edge Function create-daily-call
// ?? NON — la room et le token initiator existent côté serveur, mais le
// destinataire a besoin de SON propre meeting token. Pour MVP, on rappelle
// l'Edge Function en passant le conversation_id ET un flag `join_existing`...
// MAIS simplifié : on génère juste un meeting token à part via une 2e Edge
// Function `join-daily-call` (TODO follow-up). En attendant, on accepte
// l'appel en navigant vers /call/[id] avec le roomUrl partagé et un token
// vide → Daily.co accepte les rooms publiques sans token aussi (selon le
// niveau de sécu config en serveur).
//
// LIMITE MVP : on passe le roomUrl directement (room créée publique côté
// Edge Function — pas de protection token strict pour le destinataire).
// À renforcer post-bêta avec Edge Function `join-daily-call`.

import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Phone, PhoneOff, User as UserIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { requestCallPermissions } from '@/features/calls/hooks/useCallPermissions';
import { useConversationHeader } from '@/features/messaging/hooks/useConversationHeader';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const RING_TIMEOUT_MS = 30_000;

export default function IncomingCallScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    conversationId: string;
    callType: 'audio' | 'video';
    roomUrl: string;
  }>();

  const callId = typeof params.id === 'string' ? params.id : null;
  const conversationId = typeof params.conversationId === 'string' ? params.conversationId : null;
  const callType = params.callType === 'video' ? 'video' : 'audio';
  const roomUrl = typeof params.roomUrl === 'string' ? params.roomUrl : null;

  // Header du DM pour avatar + display_name
  const header = useConversationHeader(conversationId).data;

  const [decided, setDecided] = useState(false);

  // Animation pulse simple sur l'avatar pour signaler l'appel
  const pulse = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Update status d'un call via RPC end_call (réutilise la RPC existante,
  // qui accepte n'importe quelle valeur de call_status valide).
  const updateCallStatus = useCallback(
    async (status: 'rejected' | 'missed' | 'accepted') => {
      if (!callId) return;
      try {
        const { error } = await supabase.rpc('end_call', {
          p_call_id: callId,
          p_status: status,
        });
        if (error) logger.warn('Incoming call status update failed', { message: error.message });
      } catch (e) {
        logger.warn('Incoming call RPC threw', {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [callId]
  );

  // Auto-timeout 30s → missed
  useEffect(() => {
    if (decided) return undefined;
    const timer = setTimeout(() => {
      if (decided) return;
      void updateCallStatus('missed');
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/messages');
    }, RING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [decided, updateCallStatus]);

  const handleAccept = useCallback(async () => {
    if (decided || !roomUrl || !callId) return;
    // Ticket #235 : permissions avant accept
    const granted = await requestCallPermissions(callType);
    if (!granted) {
      // L'user a refusé les permissions → on rejette l'appel proprement
      void updateCallStatus('rejected');
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/messages');
      return;
    }
    setDecided(true);
    // On marque le call accepted, puis on navigue vers le screen call
    // standard avec le roomUrl reçu. Note MVP : pas de token destinataire
    // (room créée sans token strict — limite documentée dans le commentaire
    // de header). À renforcer post-bêta.
    void updateCallStatus('accepted');
    router.replace({
      pathname: '/call/[id]',
      params: {
        id: callId,
        roomUrl,
        token: '', // MVP : pas de token destinataire (cf header note)
        callType,
        isInitiator: '0',
      },
    });
  }, [callId, callType, decided, roomUrl, updateCallStatus]);

  const handleDecline = useCallback(() => {
    if (decided) return;
    setDecided(true);
    void updateCallStatus('rejected');
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/messages');
  }, [decided, updateCallStatus]);

  const displayName = header?.display_name ?? 'Appel entrant';
  const initial = displayName.charAt(0).toUpperCase() || '?';

  return (
    <View flex={1} backgroundColor="#000000">
      <StatusBar style="light" />

      {/* Header texte */}
      <YStack
        position="absolute"
        top={insets.top + 60}
        left={0}
        right={0}
        alignItems="center"
        gap={6}
      >
        <Text color="#A0A0A0" fontSize={14}>
          {callType === 'video' ? 'Appel vidéo entrant' : 'Appel audio entrant'}
        </Text>
        <Text color="#FFFFFF" fontSize={26} fontWeight="800">
          {displayName}
        </Text>
      </YStack>

      {/* Avatar pulsant au centre */}
      <View flex={1} alignItems="center" justifyContent="center">
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <YStack
            width={160}
            height={160}
            borderRadius={9999}
            backgroundColor="#1A1A1A"
            borderWidth={3}
            borderColor="#10D970"
            alignItems="center"
            justifyContent="center"
          >
            {header?.display_avatar_url ? (
              // expo-image serait mieux mais on garde minimal pour MVP
              <Text color="#FFFFFF" fontSize={56} fontWeight="800">
                {initial}
              </Text>
            ) : (
              <UserIcon size={64} color="#A0A0A0" />
            )}
          </YStack>
        </Animated.View>
      </View>

      {/* Boutons Decline / Accept */}
      <XStack
        position="absolute"
        bottom={insets.bottom + 60}
        left={0}
        right={0}
        justifyContent="space-around"
        alignItems="center"
      >
        <Pressable
          onPress={handleDecline}
          disabled={decided}
          style={styles.declineButton}
          accessibilityRole="button"
          accessibilityLabel="Refuser l'appel"
          accessibilityHint="Tap pour refuser cet appel entrant"
        >
          <PhoneOff size={32} color="#FFFFFF" />
        </Pressable>
        <Pressable
          onPress={() => {
            void handleAccept();
          }}
          disabled={decided}
          style={styles.acceptButton}
          accessibilityRole="button"
          accessibilityLabel="Accepter l'appel"
          accessibilityHint={`Tap pour répondre à l'appel ${callType === 'video' ? 'vidéo' : 'audio'}`}
        >
          <Phone size={32} color="#FFFFFF" />
        </Pressable>
      </XStack>
    </View>
  );
}

const styles = StyleSheet.create({
  acceptButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#10D970',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
