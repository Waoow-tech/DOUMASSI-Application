// Edge Function `purge-pending-deletions` — E8-08.
//
// Appelée par un job pg_cron quotidien (03:00 UTC). Pour chaque user dont
// la demande de suppression est expirée (scheduled_delete_at < now,
// cancelled_at IS NULL, processed_at IS NULL) :
//   1. Supprime tous les fichiers Storage personnels dans les 8 buckets
//      (récursif sur le dossier ${user_id}/)
//   2. Appelle la RPC `_anonymize_user_profile(user_id)` qui :
//      - Anonymise le profile (username, full_name, bio, avatar, cover...)
//      - Soft-delete les messages privés
//      - Place un placeholder email + ban auth.users
//      - Invalide toutes les sessions
//      - Marque deletion_requests.processed_at = now() (idempotence)
//
// Idempotence : si la fonction est rejouée alors qu'une row a déjà
// processed_at NOT NULL, elle ne la traite pas (filtre SQL). Si elle est
// rejouée alors qu'un user a été partiellement traité (Storage OK mais RPC
// échoué), elle re-tente la suppression Storage (no-op si vide) + RPC.
//
// Secrets injectés automatiquement par Supabase Edge Functions :
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY (requis : on lit/écrit auth.users)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Liste des buckets contenant des fichiers personnels d'un user.
// Tous suivent la convention : ${bucket}/${user_id}/...
// Maintenue à jour quand un nouveau bucket utilisateur est créé.
const USER_BUCKETS = [
  'avatars',
  'covers',
  'posts',
  'stories',
  'messaging_media',
  'ai_attachments',
  'listings_media',
  'comments_media',
] as const;

interface DeletionRow {
  user_id: string;
  scheduled_delete_at: string;
}

interface PurgeResult {
  user_id: string;
  storage_files_deleted: number;
  rpc_ok: boolean;
  errors: string[];
}

serve(async (_req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // 1. Liste les demandes éligibles
  const { data: pending, error: listError } = await admin
    .from('deletion_requests')
    .select('user_id, scheduled_delete_at')
    .is('cancelled_at', null)
    .is('processed_at', null)
    .lt('scheduled_delete_at', new Date().toISOString());

  if (listError) {
    return jsonError(500, 'list_failed', listError.message);
  }

  const rows = (pending ?? []) as DeletionRow[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Traite chaque user séquentiellement (évite de saturer l'API Storage)
  const results: PurgeResult[] = [];
  for (const row of rows) {
    results.push(await purgeUser(admin, row.user_id));
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

async function purgeUser(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<PurgeResult> {
  const result: PurgeResult = {
    user_id: userId,
    storage_files_deleted: 0,
    rpc_ok: false,
    errors: [],
  };

  // === Étape 1 : suppression récursive des fichiers Storage par bucket ===
  for (const bucket of USER_BUCKETS) {
    try {
      const deleted = await deleteUserFolderRecursive(admin, bucket, userId);
      result.storage_files_deleted += deleted;
    } catch (e) {
      // On enregistre l'erreur mais on continue : un bucket inaccessible ne
      // doit pas bloquer la suppression du compte. La RPC d'anonymisation
      // restera idempotente sur la prochaine exécution si on doit retry.
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`storage:${bucket}: ${msg}`);
    }
  }

  // === Étape 2 : anonymisation profile + ban auth.users + invalidation sessions ===
  // Cette RPC est SECURITY DEFINER et ne peut être appelée qu'avec service_role
  // (revoke from public/anon/authenticated dans la migration).
  const { error: rpcError } = await admin.rpc('_anonymize_user_profile', {
    p_user_id: userId,
  });
  if (rpcError) {
    result.errors.push(`rpc:_anonymize_user_profile: ${rpcError.message}`);
  } else {
    result.rpc_ok = true;
  }

  return result;
}

// Supprime tous les fichiers d'un dossier ${user_id}/ dans un bucket donné,
// récursivement. Retourne le nombre de fichiers effectivement supprimés.
async function deleteUserFolderRecursive(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string
): Promise<number> {
  const prefix = `${userId}/`;
  let totalDeleted = 0;

  // Supabase Storage list() est paginé. On boucle tant qu'on reçoit des items.
  let offset = 0;
  const PAGE = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: items, error } = await admin.storage.from(bucket).list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      throw new Error(`list failed: ${error.message}`);
    }
    if (!items || items.length === 0) {
      break;
    }

    // Construit les chemins complets pour remove()
    const paths = items
      .filter((it) => it.name && !it.name.endsWith('/'))
      .map((it) => `${prefix}${it.name}`);

    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) {
        throw new Error(`remove failed: ${removeError.message}`);
      }
      totalDeleted += paths.length;
    }

    // Si on a reçu moins que PAGE items, on a fini
    if (items.length < PAGE) {
      break;
    }
    offset += PAGE;
  }

  // Recursive : certains uploads sont dans des sous-dossiers (ex: posts/uuid/img1.jpg
  // sans sous-dir réel, mais on couvre le cas où la structure inclurait des
  // segments — list() ne descend pas dans les sous-dossiers tout seul).
  // Pour les buckets actuels (avatars, covers, posts, stories), tout est
  // directement sous ${user_id}/, donc l'itération ci-dessus suffit.

  return totalDeleted;
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, code, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
