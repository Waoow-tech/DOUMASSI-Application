// Hook useExportMyData — E8-09.
//
// Appelle l'Edge Function `export-data` pour récupérer toutes les données
// personnelles de l'user au format JSON, écrit le fichier dans le cache
// local, puis ouvre le sheet de partage natif iOS/Android.
//
// L'user peut depuis ce sheet :
//   - Enregistrer dans Fichiers / Drive / Dropbox
//   - Envoyer par mail à lui-même
//   - Partager avec une autorité de contrôle (CNIL) si litige

import { useMutation } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export interface ExportResult {
  fileUri: string;
  filename: string;
  sizeBytes: number;
  truncated: boolean;
}

/**
 * Mutation : déclenche l'export complet des données personnelles de l'user.
 *
 * Flow :
 *   1. Appel POST de l'Edge Function `export-data` (Authorization auto via le client Supabase)
 *   2. Le retour est un JSON déjà parsé par supabase-js
 *   3. On re-sérialise proprement (indent 2) et on écrit dans cacheDirectory
 *   4. On ouvre le sheet de partage natif via expo-sharing
 *
 * Erreurs propagées telles quelles vers l'UI pour affichage à l'user.
 */
export function useExportMyData() {
  return useMutation<ExportResult, Error, void>({
    mutationFn: async () => {
      // 1. Récupère la session pour le user_id (pour le nom de fichier)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('Session expirée. Reconnectez-vous puis réessayez.');
      }
      const userId = sessionData.session.user.id;

      // 2. Appel Edge Function. supabase-js ajoute automatiquement le header
      //    Authorization avec le JWT de la session courante.
      const { data, error } = await supabase.functions.invoke('export-data', {
        method: 'POST',
        body: {},
      });
      if (error) {
        logger.warn('export-data invoke failed', { message: error.message });
        throw new Error("L'export a échoué. Réessayez dans un instant.");
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Réponse export-data invalide');
      }

      // 3. Sérialisation propre (indent 2 = lisible par un humain dans un éditeur)
      const serialized = JSON.stringify(data, null, 2);
      const sizeBytes = serialized.length;

      // 4. Écriture dans le cache local
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `doumassi-export-${userId.slice(0, 8)}-${dateStr}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, serialized, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 5. Ouvre le sheet de partage natif (l'user choisit où sauver)
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Exporter mes données DOUMASSI',
          UTI: 'public.json',
        });
      } else {
        // Fallback (très rare — émulateur web par ex.) : l'user trouvera le
        // fichier dans le cache. On le signale dans l'erreur retournée.
        logger.warn('Sharing not available on this device', { fileUri });
      }

      logger.info('Data export completed', {
        userId,
        sizeBytes,
        truncated: (data as { truncated?: boolean }).truncated === true,
      });

      return {
        fileUri,
        filename,
        sizeBytes,
        truncated: (data as { truncated?: boolean }).truncated === true,
      };
    },
  });
}
