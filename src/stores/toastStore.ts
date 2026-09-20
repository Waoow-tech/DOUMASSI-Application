// toastStore — E2-13
//
// Toast applicatif global : un feedback court, non bloquant, affiché en haut de
// l'écran puis auto-masqué. Contrairement à Alert.alert (natif, modal, moche),
// il ne coupe pas l'utilisateur et vit au niveau du root layout, donc il marche
// AUSSI sur les écrans non authentifiés (login, signup…), là où RewardToast
// (monté dans (tabs)) n'existe pas.
//
// Volontairement pas persisté : c'est un feedback éphémère.

import { create } from 'zustand';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastPayload {
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  /** Toast en cours, ou null si aucun. */
  current: ToastPayload | null;
  show: (message: string, variant?: ToastVariant) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  current: null,
  show: (message, variant = 'error') => set({ current: { message, variant } }),
  hide: () => set({ current: null }),
}));

/**
 * Helper impératif (hors composant React) pour déclencher un toast depuis un
 * hook ou une fonction utilitaire sans avoir à passer par un hook.
 */
export function showToast(message: string, variant: ToastVariant = 'error') {
  useToastStore.getState().show(message, variant);
}
