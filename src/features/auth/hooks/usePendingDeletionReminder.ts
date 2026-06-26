// usePendingDeletionReminder — Sprint 6, ticket #214.
//
// Détermine s'il faut afficher la modale de rappel de suppression de compte
// à l'utilisateur courant. La modale s'affiche AU PLUS UNE FOIS PAR SESSION :
// dès que l'utilisateur la ferme (annule OU "Plus tard"), on la masque
// jusqu'à la prochaine reconnexion.
//
// Le "1×/session" est implémenté par un useState local : ce hook étant monté
// dans `(tabs)/_layout.tsx` derrière le guard auth, le state est unmount à
// chaque logout/login (le composant `AuthenticatedTabs` est démonté quand
// le guard repasse par 'unauthenticated'). Pas besoin d'AsyncStorage.

import { useCallback, useState } from 'react';

import {
  useDeletionRequest,
  type DeletionRequestRow,
} from '@/features/auth/hooks/useDeletionRequest';

export interface PendingDeletionReminder {
  /** La modale doit-elle être affichée ? */
  shouldShow: boolean;
  /** Row active si présente (utile pour passer à la modale). */
  request: DeletionRequestRow | null;
  /** À appeler quand l'utilisateur ferme la modale (annulée OU "Plus tard"). */
  dismiss: () => void;
}

export function usePendingDeletionReminder(): PendingDeletionReminder {
  const { data: request } = useDeletionRequest();
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    shouldShow: !dismissed && request !== null && request !== undefined,
    request: request ?? null,
    dismiss,
  };
}
