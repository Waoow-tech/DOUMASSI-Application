// rewardToastStore — E12-08
//
// File d'attente minimale pour afficher un toast « +N Dcoins » suite à un gain
// (bonus quotidien pour l'instant ; réutilisable pour d'autres gains plus tard).
// Volontairement pas persisté : c'est un feedback éphémère.

import { create } from 'zustand';

interface RewardToastState {
  /** Montant à afficher, ou null si aucun toast en cours. */
  amount: number | null;
  show: (amount: number) => void;
  hide: () => void;
}

export const useRewardToastStore = create<RewardToastState>((set) => ({
  amount: null,
  show: (amount) => set({ amount }),
  hide: () => set({ amount: null }),
}));
