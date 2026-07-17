// useWallet — E12-03 (#327)
//
// Accès au wallet Dcoins : solde, historique, transfert, dépense.
// Voir ADR-005.
//
// Lecture : SELECT direct sur `wallets` / `wallet_transactions` — la RLS
// (E12-01) restreint déjà au propre wallet de l'utilisateur, pas besoin de RPC.
//
// Écriture : UNIQUEMENT via les RPC (E12-02). La RLS n'expose aucune policy
// d'écriture, donc toute tentative d'INSERT/UPDATE direct serait refusée.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useRewardToastStore } from '@/stores/rewardToastStore';

const PAGE_SIZE = 20;

export type WalletTransactionType =
  | 'grant'
  | 'reward'
  | 'topup'
  | 'transfer_in'
  | 'transfer_out'
  | 'tip_in'
  | 'tip_out'
  | 'purchase'
  | 'refund'
  | 'adjustment';

export interface WalletTransaction {
  id: string;
  /** Montant SIGNÉ en Dcoins : positif = crédit, négatif = débit. */
  amount: number;
  type: WalletTransactionType;
  counterparty_user_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

interface WalletTransactionsPage {
  transactions: WalletTransaction[];
  nextCursor: string | null;
}

/** Racine des clés de cache wallet — invalider `['wallet']` rafraîchit tout. */
export const walletQueryKey = ['wallet'] as const;
export const walletBalanceQueryKey = ['wallet', 'balance'] as const;
export const walletTransactionsQueryKey = ['wallet', 'transactions'] as const;

/**
 * Génère une clé d'idempotence pour un mouvement de wallet.
 *
 * ⚠️ À appeler UNE SEULE FOIS par opération logique, au moment où l'utilisateur
 * déclenche l'action — puis à passer telle quelle à la mutation. Si on la
 * régénérait à chaque tentative, un retry (réseau instable, double tap) créerait
 * une NOUVELLE clé et donc un SECOND débit. C'est tout l'intérêt : rejouer la
 * même clé est neutralisé côté serveur.
 *
 * Pas de dépendance crypto ici (aucune n'est installée, et on n'ajoute pas de
 * package hors stack) : ce n'est pas un enjeu adversarial. L'unicité est scopée
 * (user_id, idempotency_key) — un utilisateur ne peut affecter que ses propres
 * clés, jamais celles d'un autre.
 */
export function newIdempotencyKey(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`;
}

function toTransaction(row: Record<string, unknown>): WalletTransaction {
  return {
    id: String(row.id ?? ''),
    amount: Number(row.amount ?? 0),
    type: (row.type as WalletTransactionType) ?? 'adjustment',
    counterparty_user_id: (row.counterparty_user_id as string | null) ?? null,
    reference_type: (row.reference_type as string | null) ?? null,
    reference_id: (row.reference_id as string | null) ?? null,
    balance_after: Number(row.balance_after ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

/** Solde Dcoins de l'utilisateur courant. */
export function useWallet() {
  return useQuery({
    queryKey: walletBalanceQueryKey,
    queryFn: async (): Promise<number> => {
      // La RLS ne laisse passer que la ligne de l'utilisateur courant.
      const { data, error } = await supabase.from('wallets').select('balance').maybeSingle();

      if (error) {
        logger.warn('wallet balance fetch failed', { message: error.message });
        throw error;
      }

      return Number((data as { balance?: unknown } | null)?.balance ?? 0);
    },
    staleTime: 15_000,
  });
}

/** Historique paginé (le plus récent d'abord). */
export function useWalletTransactions() {
  return useInfiniteQuery<WalletTransactionsPage>({
    queryKey: walletTransactionsQueryKey,
    initialPageParam: null,
    queryFn: async ({ pageParam }): Promise<WalletTransactionsPage> => {
      let query = supabase
        .from('wallet_transactions')
        .select(
          'id, amount, type, counterparty_user_id, reference_type, reference_id, balance_after, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      // Curseur sur created_at (cohérent avec la pagination du feed).
      if (typeof pageParam === 'string') {
        query = query.lt('created_at', pageParam);
      }

      const { data, error } = await query;

      if (error) {
        logger.warn('wallet transactions fetch failed', { message: error.message });
        throw error;
      }

      const transactions = ((data ?? []) as Record<string, unknown>[]).map(toTransaction);
      const last = transactions[transactions.length - 1];

      return {
        transactions,
        nextCursor: transactions.length === PAGE_SIZE ? (last?.created_at ?? null) : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 15_000,
  });
}

export interface TransferVariables {
  toUserId: string;
  amount: number;
  /** Générée par `newIdempotencyKey()` à l'initiation de l'action — voir sa doc. */
  idempotencyKey: string;
  /** true => tip_out/tip_in au lieu de transfer_out/transfer_in. */
  isTip?: boolean;
  referenceType?: string | null;
  referenceId?: string | null;
}

/** Envoi de Dcoins à un autre utilisateur (P2P ou pourboire). Retourne le nouveau solde. */
export function useWalletTransfer() {
  const queryClient = useQueryClient();

  return useMutation<number, Error, TransferVariables>({
    mutationFn: async ({
      toUserId,
      amount,
      idempotencyKey,
      isTip = false,
      referenceType = null,
      referenceId = null,
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('wallet_transfer', {
        p_to_user: toUserId,
        p_amount: amount,
        p_idempotency_key: idempotencyKey,
        p_is_tip: isTip,
        p_reference_type: referenceType,
        p_reference_id: referenceId,
      });

      if (error) {
        logger.warn('wallet_transfer failed', { message: error.message });
        throw error;
      }

      return Number(data ?? 0);
    },
    onSuccess: () => {
      // Solde ET historique changent (2 lignes de ledger côté émetteur/récepteur).
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
    },
  });
}

interface DailyClaimResult {
  granted: boolean;
  amount: number;
  balance: number;
}

/**
 * Réclame le bonus de connexion quotidienne (E12-07 `wallet_claim_daily`).
 * À monter UNE fois dans le layout authentifié. Idempotent côté serveur (1×/jour),
 * donc sans risque même si le composant se remonte. Si un gain a lieu, invalide
 * le solde et déclenche le toast de récompense.
 */
export function useClaimDailyReward() {
  const queryClient = useQueryClient();
  const showRewardToast = useRewardToastStore((s) => s.show);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    void (async () => {
      const { data, error } = await supabase.rpc('wallet_claim_daily');
      if (error) {
        // Non bloquant : un bonus raté n'empêche pas d'utiliser l'app.
        logger.warn('wallet_claim_daily failed', { message: error.message });
        return;
      }
      const result = data as DailyClaimResult | null;
      if (result?.granted) {
        queryClient.invalidateQueries({ queryKey: walletQueryKey });
        showRewardToast(result.amount);
      }
    })();
  }, [queryClient, showRewardToast]);
}

export interface SpendVariables {
  amount: number;
  /** Générée par `newIdempotencyKey()` à l'initiation de l'action — voir sa doc. */
  idempotencyKey: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

/** Dépense de Dcoins sur une feature payante (IA, boost). Retourne le nouveau solde. */
export function useWalletSpend() {
  const queryClient = useQueryClient();

  return useMutation<number, Error, SpendVariables>({
    mutationFn: async ({
      amount,
      idempotencyKey,
      referenceType = null,
      referenceId = null,
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('wallet_spend', {
        p_amount: amount,
        p_idempotency_key: idempotencyKey,
        p_reference_type: referenceType,
        p_reference_id: referenceId,
      });

      if (error) {
        logger.warn('wallet_spend failed', { message: error.message });
        throw error;
      }

      return Number(data ?? 0);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletQueryKey });
    },
  });
}
