// PendingDeletionModal — Sprint 6, ticket #214.
//
// Modal Tamagui Sheet affichée 1× par session quand un utilisateur avec une
// demande de suppression de compte active se reconnecte. Lui propose de
// l'annuler avant l'échéance J+30.
//
// Cas d'usage : un user a tapé "Supprimer mon compte" il y a 10 jours,
// l'a oublié, et se reconnecte aujourd'hui. Sans cette modale, son compte
// serait supprimé à J+30 sans rappel visible. On évite la perte de données
// involontaire.
//
// Comportement :
//   - Tap "Annuler la demande" : RPC cancelDeletion + ferme la modale +
//     invalide la query deletion-request (gérée par le hook)
//   - Tap "Plus tard" : ferme la modale sans annuler (le compte reste en
//     pending). La modale ne réapparaît plus dans cette session, mais
//     revient à la prochaine reconnexion.
//   - Tap backdrop : équivaut à "Plus tard"

import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { Button, Sheet, Text, YStack } from 'tamagui';

import {
  useCancelDeletion,
  type DeletionRequestRow,
} from '@/features/auth/hooks/useDeletionRequest';

export interface PendingDeletionModalProps {
  open: boolean;
  request: DeletionRequestRow;
  onClose: () => void;
}

function formatScheduledDateFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDaysRemaining(iso: string): number {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  const days = Math.max(0, Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24)));
  return days;
}

export function PendingDeletionModal({ open, request, onClose }: PendingDeletionModalProps) {
  const cancelDeletion = useCancelDeletion();
  const formattedDate = formatScheduledDateFr(request.scheduled_delete_at);
  const daysLeft = formatDaysRemaining(request.scheduled_delete_at);

  const handleCancel = useCallback(() => {
    cancelDeletion.mutate(undefined, {
      onSuccess: () => {
        onClose();
        // Confirmation simple via Alert pour ne pas dépendre d'un toast system.
        Alert.alert(
          'Suppression annulée',
          'Bienvenue ! Ton compte est conservé. Tu peux refaire une demande à tout moment depuis Paramètres.'
        );
      },
      onError: (err) => {
        Alert.alert(
          'Erreur',
          err instanceof Error ? err.message : "Impossible d'annuler pour le moment. Réessaie."
        );
      },
    });
  }, [cancelDeletion, onClose]);

  const handleOpenSettings = useCallback(() => {
    onClose();
    router.push('/settings');
  }, [onClose]);

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
      snapPoints={[55]}
      dismissOnSnapToBottom
      animation="medium"
    >
      <Sheet.Overlay backgroundColor="rgba(0,0,0,0.7)" />
      <Sheet.Frame backgroundColor="$background" padding="$5" gap="$4">
        <Sheet.Handle backgroundColor="$borderColor" />

        <YStack gap="$2">
          <Text fontSize={22} fontWeight="700" color="$color">
            Suppression programmée
          </Text>
          <Text fontSize={15} color="$textSecondary" lineHeight={22}>
            Tu as demandé la suppression de ton compte. Sans action, il sera supprimé définitivement
            le{' '}
            <Text fontSize={15} color="$color" fontWeight="600">
              {formattedDate}
            </Text>
            {daysLeft > 0 ? ` (dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''})` : ''}.
          </Text>
        </YStack>

        <YStack gap="$3" marginTop="$2">
          <Button
            onPress={handleCancel}
            disabled={cancelDeletion.isPending}
            backgroundColor="$accentNeon"
            color="#000000"
            fontWeight="700"
            size="$5"
            borderRadius="$10"
            accessibilityRole="button"
            accessibilityLabel="Annuler la demande de suppression"
          >
            {cancelDeletion.isPending ? 'Annulation…' : 'Annuler la demande'}
          </Button>

          <Button
            onPress={handleOpenSettings}
            variant="outlined"
            color="$color"
            size="$4"
            borderRadius="$10"
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les paramètres du compte"
          >
            Gérer dans les paramètres
          </Button>

          <Button
            onPress={onClose}
            backgroundColor="transparent"
            color="$textSecondary"
            size="$3"
            accessibilityRole="button"
            accessibilityLabel="Fermer et continuer"
          >
            Plus tard
          </Button>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}
