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
  // Breadcrumbs pour tracer exactement où le flow s'interrompt (bug bash
  // 2026-07-01 : 0 push_token en DB, cause inconnue). Chaque étape log
  // un `info` avec un contexte minimal.
  logger.info('push_token_flow_start', { userId, platform: Platform.OS });

  // Les push notifs ne fonctionnent pas en simulateur — skip silencieusement
  // (pas de log d'erreur, c'est attendu en dev sur émulateur).
  if (!Device.isDevice) {
    logger.info('push_token_skipped_simulator');
    return;
  }

  if (!PROJECT_ID) {
    logger.warn('push_token_no_eas_project_id');
    return;
  }

  // Android : canal de notif par défaut (sinon les notifs n'affichent rien)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DOUMASSI',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFFFFF',
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
  logger.info('push_token_permission_status', { status });

  if (status !== 'granted') {
    logger.info('push_token_permission_denied', { userId });
    return;
  }

  // Récupérer le token. Expo génère un token stable par installation.
  // Sur Android, échoue si Firebase (google-services.json + FCM) n'est pas
  // configuré côté natif — on log en info silencieux plutôt que error car
  // c'est un pré-requis config, pas un bug runtime. La feature push notifs
  // sera juste inactive sur ce device tant que Firebase n'est pas branché.
  let token: string;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    token = tokenResponse.data;
    // Log un préfixe du token pour vérifier qu'il ressemble à un ExpoPushToken
    // valide (format : ExponentPushToken[XXXXXXXX...]). On tronque à 30 char
    // pour ne pas polluer les logs.
    logger.info('push_token_fetched', {
      preview: token.slice(0, 30),
      length: token.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (Platform.OS === 'android' && (message.includes('FirebaseApp') || message.includes('FCM'))) {
      logger.info('push_token_skipped_firebase_not_configured', { platform: 'android' });
      return;
    }
    // Autre erreur (iOS, permissions, réseau) — reste en warn pour investigation.
    logger.warn('push_token_fetch_failed', { message });
    return;
  }

  // Idempotent : on lit d'abord pour éviter un UPDATE inutile si rien n'a changé.
  const { data: profile, error: selectError } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .single();

  if (selectError) {
    logger.warn('push_token_select_failed', { message: selectError.message });
    // On tente quand même l'update — un select bloqué par RLS n'implique pas
    // forcément un update bloqué (policies peuvent différer).
  }

  if (profile?.push_token === token) {
    logger.info('push_token_unchanged_skip');
    return;
  }

  logger.info('push_token_db_update_attempt', { userId });
  const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  if (error) {
    logger.error('push_token_db_update_failed', error);
    return;
  }
  logger.info('push_token_db_update_success', { userId });
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
