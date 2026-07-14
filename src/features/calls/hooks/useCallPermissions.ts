// useCallPermissions — Ticket #235 (E6-C6).
//
// Demande au runtime les permissions micro (et caméra si video) avant un
// appel. Si refusé après la demande système, affiche un Alert avec un bouton
// "Ouvrir Réglages" qui ouvre l'écran Réglages > Notre app via expo-linking.

import { Camera } from 'expo-camera';
import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';

import { getT } from '@/i18n';
import { logger } from '@/lib/logger';

export type CallType = 'audio' | 'video';

/**
 * Demande les permissions nécessaires pour un appel.
 * Audio only : juste micro.
 * Video : micro + caméra.
 *
 * @returns true si toutes les perms sont granted, false sinon (l'Alert
 *          d'explication a déjà été affichée).
 */
export async function requestCallPermissions(callType: CallType): Promise<boolean> {
  // ─ Micro ─────────────────────────────────────────────────────────────
  let micPerm = await Camera.getMicrophonePermissionsAsync();
  if (!micPerm.granted) {
    micPerm = await Camera.requestMicrophonePermissionsAsync();
  }
  if (!micPerm.granted) {
    logger.warn('Mic permission denied');
    showPermissionDeniedAlert('micro');
    return false;
  }

  if (callType === 'audio') return true;

  // ─ Caméra (video only) ───────────────────────────────────────────────
  let camPerm = await Camera.getCameraPermissionsAsync();
  if (!camPerm.granted) {
    camPerm = await Camera.requestCameraPermissionsAsync();
  }
  if (!camPerm.granted) {
    logger.warn('Camera permission denied');
    showPermissionDeniedAlert('caméra');
    return false;
  }

  return true;
}

function showPermissionDeniedAlert(kind: 'micro' | 'caméra') {
  const t = getT();
  const what =
    kind === 'micro'
      ? t.messaging.calls.permissions.deviceMic
      : t.messaging.calls.permissions.deviceCamera;
  Alert.alert(
    t.messaging.calls.permissions.deniedTitle,
    t.messaging.calls.permissions.deniedMessage(what),
    [
      { text: t.messaging.common.cancel, style: 'cancel' },
      {
        text: t.messaging.calls.permissions.openSettings,
        onPress: () => {
          // expo-linking ouvre les Réglages > Notre app sur iOS et Android
          if (Platform.OS === 'ios') {
            void Linking.openURL('app-settings:');
          } else {
            void Linking.openSettings();
          }
        },
      },
    ]
  );
}
