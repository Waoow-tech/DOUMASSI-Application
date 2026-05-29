// usePushToken — E4-14.
// Enregistre le token Expo Push du device dans `profiles.push_token` au
// premier mount sous le guard auth (= dans AuthenticatedTabs, voir
// app/(tabs)/_layout.tsx).
//
// Pattern :
//   1. Vérifie/demande la permission notif iOS+Android
//   2. Si accordée : récupère le token via getExpoPushTokenAsync
//   3. PATCH profiles.push_token (idempotent — pas de réécriture si même token)
//
// Côté serveur, l'Edge Function `send-push` envoie via Expo Push API et
// reset `push_token = null` si Expo répond DeviceNotRegistered (cf #54
// préreqs CTO, PR #182).

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

async function registerPushToken(userId: string): Promise<void> {
  // Les push notifs ne fonctionnent pas en simulateur — skip silencieusement
  // (pas de log d'erreur, c'est attendu en dev sur émulateur).
  if (!Device.isDevice) return;

  if (!PROJECT_ID) {
    logger.warn('No EAS projectId in app.json — cannot register push token');
    return;
  }

  // Android : canal de notif par défaut (sinon les notifs n'affichent rien)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DOUMASSI',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10D970',
    });
  }

  // Vérifier la permission existante avant de demander (évite de re-prompt
  // chaque ouverture si l'user a déjà refusé une fois).
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (existingStatus !== 'granted') {
    const response = await Notifications.requestPermissionsAsync();
    status = response.status;
  }

  if (status !== 'granted') {
    logger.info('push_permission_denied', { userId });
    return;
  }

  // Récupérer le token. Expo génère un token stable par installation.
  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
  const token = tokenResponse.data;

  // Idempotent : on lit d'abord pour éviter un UPDATE inutile si rien n'a changé.
  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .single();

  if (profile?.push_token === token) return;

  const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  if (error) {
    logger.error('register_push_token_failed', error);
  }
}

/**
 * Lance l'enregistrement du push token au mount. Récupère le userId
 * via supabase.auth.getSession() — on n'est appelé que sous le guard
 * auth, donc la session existe forcément.
 */
export function usePushToken(): void {
  useEffect(() => {
    let cancelled = false;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const userId = data.session?.user.id;
        if (!userId) return;
        return registerPushToken(userId);
      })
      .catch((err) => {
        logger.error('register_push_token_unexpected', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);
}
