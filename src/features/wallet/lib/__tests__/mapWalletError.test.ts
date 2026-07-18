// Tests E12 — mapWalletError
//
// Le mapper traduit les messages d'exception FRANÇAIS levés par les RPC wallet
// (côté Postgres) vers un message utilisateur localisé. C'est la surface d'erreur
// que voit l'utilisateur sur une opération d'argent → on la teste explicitement.
//
// Couverture :
//   • Reconnaissance de chaque message d'erreur RPC connu (FR).
//   • Fallback générique (message inconnu / null).
//   • Bascule de langue (le même message RPC FR → traduction EN).

import { mapWalletError } from '@/features/wallet/lib/mapWalletError';
import { getT } from '@/i18n';
import { useLanguageStore } from '@/stores/languageStore';

function errors() {
  return getT().wallet.send.errors;
}

describe('mapWalletError', () => {
  beforeEach(() => {
    // Point de départ déterministe (la détection device n'influence pas le test).
    useLanguageStore.setState({ language: 'fr' });
  });

  it('reconnaît « Solde insuffisant »', () => {
    expect(mapWalletError('Solde insuffisant')).toBe(errors().insufficient);
  });

  it('reconnaît le transfert vers soi-même', () => {
    expect(mapWalletError('Transfert vers soi-même interdit')).toBe(errors().self);
  });

  it('reconnaît « Destinataire introuvable »', () => {
    expect(mapWalletError('Destinataire introuvable')).toBe(errors().recipientNotFound);
  });

  it('reconnaît « Montant invalide »', () => {
    expect(mapWalletError('Montant invalide : doit être > 0')).toBe(errors().invalidAmount);
  });

  it('est insensible à la casse', () => {
    expect(mapWalletError('SOLDE INSUFFISANT')).toBe(errors().insufficient);
  });

  it('retombe sur le message générique pour une erreur inconnue', () => {
    expect(mapWalletError('some postgres gibberish 42P01')).toBe(errors().generic);
  });

  it('retombe sur le générique pour null / undefined / vide', () => {
    expect(mapWalletError(null)).toBe(errors().generic);
    expect(mapWalletError(undefined)).toBe(errors().generic);
    expect(mapWalletError('')).toBe(errors().generic);
  });

  it('suit la langue courante : le même message RPC FR se traduit en EN', () => {
    useLanguageStore.setState({ language: 'en' });
    const enInsufficient = getT().wallet.send.errors.insufficient;
    expect(enInsufficient).toBe('Insufficient balance.');
    expect(mapWalletError('Solde insuffisant')).toBe(enInsufficient);
  });
});
