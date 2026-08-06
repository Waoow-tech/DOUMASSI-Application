// CallScreen — Ticket #232 (E6-C3).
//
// Écran plein écran qui rejoint une room Daily.co et expose les contrôles
// in-call : mute, camera on/off, switch camera (video only), hangup.
//
// Params route :
//   - id          : call_id (UUID dans public.calls)
//   - roomUrl     : URL Daily.co (https://doumassi.daily.co/<room>)
//   - token       : meeting token court-lived signé par l'Edge Function
//   - callType    : 'audio' | 'video'
//   - isInitiator : '1' si c'est moi qui ai créé l'appel
//
// Cycle de vie :
//   - Mount : Daily.createCallObject + join(url, token) + listeners
//   - Hangup ou peer-left : leave() + destroy() + RPC end_call('ended')
//   - Unmount sans hangup propre : leave() + destroy() (best effort)

import Daily, {
  DailyMediaView,
  type DailyCall,
  type DailyParticipant,
} from '@daily-co/react-native-daily-js';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Phone,
  SwitchCamera,
  User as UserIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

type CallStatus = 'connecting' | 'connected' | 'ended';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    roomUrl: string;
    token: string;
    callType: 'audio' | 'video';
  }>();

  const callId = typeof params.id === 'string' ? params.id : null;
  const roomUrl = typeof params.roomUrl === 'string' ? params.roomUrl : null;
  const token = typeof params.token === 'string' ? params.token : null;
  const callType = params.callType === 'video' ? 'video' : 'audio';
  const isVideo = callType === 'video';

  const callObjectRef = useRef<DailyCall | null>(null);
  const [status, setStatus] = useState<CallStatus>('connecting');
  const [localParticipant, setLocalParticipant] = useState<DailyParticipant | null>(null);
  const [remoteParticipant, setRemoteParticipant] = useState<DailyParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(!isVideo);
  const [durationSec, setDurationSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  // ─ Init Daily call object + join ────────────────────────────────────────
  useEffect(() => {
    if (!roomUrl || !token) {
      router.back();
      return;
    }

    const call: DailyCall = Daily.createCallObject({
      audioSource: true,
      videoSource: isVideo,
      // Throttle natif RN — pas de DOM/CSS, on garde simple
      subscribeToTracksAutomatically: true,
    });
    callObjectRef.current = call;

    const refreshParticipants = () => {
      const all = call.participants();
      setLocalParticipant(all.local);
      const remote = Object.values(all).find((p) => p.session_id !== all.local.session_id);
      setRemoteParticipant(remote ?? null);
    };

    call.on('joined-meeting', () => {
      setStatus('connected');
      startedAtRef.current = Date.now();
      refreshParticipants();
    });
    call.on('participant-joined', refreshParticipants);
    call.on('participant-updated', refreshParticipants);
    call.on('participant-left', () => {
      refreshParticipants();
      // Si le seul autre participant quitte → on raccroche aussi
      const all = call.participants();
      const stillRemote = Object.values(all).find((p) => p.session_id !== all.local.session_id);
      if (!stillRemote) {
        void handleHangup('ended');
      }
    });
    call.on('error', (e) => {
      logger.warn('Daily error', { message: JSON.stringify(e) });
    });

    void call
      .join({ url: roomUrl, token })
      .then(() => {
        refreshParticipants();
      })
      .catch((e: unknown) => {
        logger.warn('Daily join failed', { message: e instanceof Error ? e.message : String(e) });
        void handleHangup('ended');
      });

    // Tick durée 1Hz
    const tick = setInterval(() => {
      if (startedAtRef.current) {
        setDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      if (callObjectRef.current) {
        callObjectRef.current.leave().catch(() => undefined);
        callObjectRef.current.destroy().catch(() => undefined);
        callObjectRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token, isVideo]);

  // ─ Handlers contrôles ────────────────────────────────────────────────────
  const handleToggleMute = useCallback(() => {
    const call = callObjectRef.current;
    if (!call) return;
    const next = !isMuted;
    call.setLocalAudio(!next);
    setIsMuted(next);
  }, [isMuted]);

  const handleToggleCamera = useCallback(() => {
    const call = callObjectRef.current;
    if (!call) return;
    const next = !isCameraOff;
    call.setLocalVideo(!next);
    setIsCameraOff(next);
  }, [isCameraOff]);

  const handleSwitchCamera = useCallback(() => {
    callObjectRef.current?.cycleCamera().catch(() => undefined);
  }, []);

  const handleHangup = useCallback(
    async (finalStatus: 'ended' | 'cancelled' = 'ended') => {
      if (status === 'ended') return;
      setStatus('ended');
      const call = callObjectRef.current;
      if (call) {
        await call.leave().catch(() => undefined);
        await call.destroy().catch(() => undefined);
        callObjectRef.current = null;
      }
      if (callId) {
        try {
          const { error } = await supabase.rpc('end_call', {
            p_call_id: callId,
            p_status: finalStatus,
          });
          if (error) {
            logger.warn('end_call RPC failed', { message: error.message });
          }
        } catch (e) {
          logger.warn('end_call RPC threw', {
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/messages');
    },
    [callId, status]
  );

  // ─ Render ───────────────────────────────────────────────────────────────
  // Daily.co type `videoTrack: false | MediaStreamTrack` quand désactivé.
  // `|| null` narrow proprement en MediaStreamTrack | null pour DailyMediaView.
  const remoteVideoTrack = remoteParticipant?.videoTrack || null;
  const localVideoTrack = localParticipant?.videoTrack || null;
  const remoteAudioTrack = remoteParticipant?.audioTrack || null;

  const titleText = useMemo(() => {
    if (status === 'connecting') return t.messaging.calls.active.connecting;
    if (status === 'ended') return t.messaging.calls.active.ended;
    return formatDuration(durationSec);
  }, [status, durationSec, t]);

  return (
    <View flex={1} backgroundColor="#000000">
      <StatusBar style="light" />

      {/* Remote video (full screen) ou avatar grand audio-only */}
      {isVideo && remoteVideoTrack ? (
        <DailyMediaView
          videoTrack={remoteVideoTrack}
          audioTrack={remoteAudioTrack}
          mirror={false}
          objectFit="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          flex={1}
          backgroundColor="#0A0A0A"
          alignItems="center"
          justifyContent="center"
          gap={16}
        >
          <YStack
            width={120}
            height={120}
            borderRadius={9999}
            backgroundColor="#1A1A1A"
            alignItems="center"
            justifyContent="center"
          >
            <UserIcon size={48} color="#A0A0A0" />
          </YStack>
        </View>
      )}

      {/* Local video PIP (top-right) si video et caméra ON */}
      {isVideo && localVideoTrack && !isCameraOff ? (
        <View
          position="absolute"
          top={insets.top + 12}
          right={12}
          width={100}
          height={140}
          borderRadius={12}
          overflow="hidden"
          backgroundColor="#1A1A1A"
        >
          <DailyMediaView
            videoTrack={localVideoTrack}
            audioTrack={null}
            mirror
            objectFit="cover"
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      {/* Header overlay : titre + durée */}
      <View
        position="absolute"
        top={insets.top + 12}
        left={12}
        right={isVideo ? 124 : 12}
        backgroundColor="rgba(0,0,0,0.4)"
        borderRadius={20}
        paddingHorizontal={14}
        paddingVertical={8}
      >
        <Text color="#FFFFFF" fontSize={16} fontWeight="700" numberOfLines={1}>
          {titleText}
        </Text>
        {status === 'connecting' ? (
          <XStack alignItems="center" gap={8} marginTop={2}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text color="#A0A0A0" fontSize={12}>
              {t.messaging.calls.active.connectingToRoom}
            </Text>
          </XStack>
        ) : null}
      </View>

      {/* Contrôles bas */}
      <XStack
        position="absolute"
        bottom={insets.bottom + 32}
        left={0}
        right={0}
        justifyContent="center"
        alignItems="center"
        gap={20}
      >
        <Pressable
          onPress={handleToggleMute}
          style={[
            styles.controlButton,
            { backgroundColor: isMuted ? '#FF3B30' : 'rgba(255,255,255,0.18)' },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isMuted ? t.messaging.calls.active.unmuteMicA11y : t.messaging.calls.active.muteMicA11y
          }
        >
          {isMuted ? <MicOff size={22} color="#FFFFFF" /> : <Mic size={22} color="#FFFFFF" />}
        </Pressable>

        {isVideo ? (
          <Pressable
            onPress={handleToggleCamera}
            style={[
              styles.controlButton,
              { backgroundColor: isCameraOff ? '#FF3B30' : 'rgba(255,255,255,0.18)' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isCameraOff
                ? t.messaging.calls.active.turnOnCameraA11y
                : t.messaging.calls.active.turnOffCameraA11y
            }
          >
            {isCameraOff ? (
              <CameraOff size={22} color="#FFFFFF" />
            ) : (
              <Camera size={22} color="#FFFFFF" />
            )}
          </Pressable>
        ) : null}

        {isVideo ? (
          <Pressable
            onPress={handleSwitchCamera}
            style={[styles.controlButton, { backgroundColor: 'rgba(255,255,255,0.18)' }]}
            accessibilityRole="button"
            accessibilityLabel={t.messaging.calls.active.switchCameraA11y}
          >
            <SwitchCamera size={22} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {/* Hangup */}
        <Pressable
          onPress={() => void handleHangup('ended')}
          style={[styles.controlButton, styles.hangupButton]}
          accessibilityRole="button"
          accessibilityLabel={t.messaging.calls.active.hangUpA11y}
        >
          <Phone size={22} color="#FFFFFF" />
        </Pressable>
      </XStack>
    </View>
  );
}

const styles = StyleSheet.create({
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangupButton: {
    backgroundColor: '#FF3B30',
    transform: [{ rotate: '135deg' }],
  },
});
