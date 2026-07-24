// Convention de stockage des médias d'un post — E14-01.
//
// POURQUOI CE FICHIER EXISTE
//
// Un post vidéo a besoin de DEUX URL : la vidéo elle-même, et une image de
// couverture (poster). Sans poster, la carte du feed afficherait un `<Image>`
// pointant sur un .mp4 — donc un rectangle vide.
//
// Deux façons de stocker ce poster :
//
//   a) une colonne `posts.thumbnail_url` — propre sémantiquement, MAIS le feed
//      passe par des RPC à colonnes explicites (get_feed, get_bookmarks,
//      get_post_with_counts…). Exposer une colonne de plus impose de recréer
//      le type de retour de chacune — `create or replace function` refuse de
//      changer un type de retour, il faut drop + recreate, et le faire à la
//      main sur dev ET staging. C'est précisément le genre de manœuvre qui a
//      déjà produit deux divergences repo↔base sur ce projet.
//
//   b) réutiliser `media_urls`, qui est déjà un text[] traversant toutes les
//      RPC sans y toucher.
//
// On a retenu (b). La convention, valable UNIQUEMENT quand media_type ===
// 'video' :
//
//     media_urls = [ posterUrl, videoUrl ]
//
// `media_type` lève l'ambiguïté : pour 'image', media_urls reste la liste des
// images telle qu'avant. Aucune donnée existante n'est réinterprétée.
//
// ⚠️ Personne ne doit lire media_urls[0] ou [1] à la main ailleurs : ce fichier
// est le seul endroit qui connaît les index. C'est le prix à payer pour que la
// convention reste tenable.

/** Forme minimale commune à toutes les représentations d'un post. */
export interface PostMediaLike {
  media_type: 'text' | 'image' | 'video';
  media_urls: string[];
}

/** Construit le media_urls d'un post vidéo. Seul producteur de la convention. */
export function buildVideoMediaUrls(posterUrl: string, videoUrl: string): string[] {
  return [posterUrl, videoUrl];
}

/**
 * Image à afficher dans une carte / une grille.
 * Vidéo → le poster ; image → la première image ; texte → rien.
 */
export function getPostPosterUrl(post: PostMediaLike): string | undefined {
  return post.media_urls[0];
}

/**
 * URL de la vidéo à lire. `undefined` si le post n'est pas une vidéo.
 *
 * Tolère un post vidéo à une seule URL : d'anciens posts (ou un poster dont
 * l'upload a échoué) peuvent n'avoir que la vidéo. On préfère lire la vidéo
 * sans poster plutôt que de ne rien lire du tout.
 */
export function getPostVideoUrl(post: PostMediaLike): string | undefined {
  if (post.media_type !== 'video') return undefined;
  return post.media_urls[1] ?? post.media_urls[0];
}

/**
 * Nombre d'images à annoncer sur la carte (pastille « +N »).
 * Toujours 0 pour une vidéo : ses 2 URL sont un média, pas deux.
 */
export function getPostImageCount(post: PostMediaLike): number {
  if (post.media_type !== 'image') return 0;
  return post.media_urls.length;
}
