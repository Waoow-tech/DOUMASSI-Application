// Mappe les erreurs des RPC wallet vers un message utilisateur traduit.
//
// Les RPC (E12-02) lèvent des exceptions plpgsql avec des messages FRANÇAIS
// codés en dur côté Postgres ('Solde insuffisant', 'Transfert vers soi-même
// interdit'…). On ne peut pas les traduire à la source (le serveur ne connaît
// pas la langue de l'app), donc on les reconnaît ici pour renvoyer la bonne
// traduction.
//
// ⚠️ Couplage assumé : si on change le wording d'une exception dans les RPC, il
// faut mettre ce mapper à jour. Une version plus robuste passerait par des
// SQLSTATE custom plutôt que par le texte — à envisager si ça se multiplie.

import { getT } from '@/i18n';

export function mapWalletError(message: string | undefined | null): string {
  const e = getT().wallet.send.errors;

  if (!message) return e.generic;

  const lower = message.toLowerCase();

  if (lower.includes('solde insuffisant')) return e.insufficient;
  if (lower.includes('soi-même') || lower.includes('soi-meme')) return e.self;
  if (lower.includes('destinataire introuvable')) return e.recipientNotFound;
  if (lower.includes('montant invalide')) return e.invalidAmount;

  return e.generic;
}
