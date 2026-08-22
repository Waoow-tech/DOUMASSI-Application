// Écran "Supprimer mon compte" — E3-12.
// Conformité RGPD : pas de hard delete immédiat, on enregistre une
// demande dans `deletion_requests` avec un délai de 30 jours pour
// annulation. Le hard delete sera traité par un job background
// (ticket post-MVP).

import { router } from 'expo-router';
import { AlertTriangle, ArrowLeft, ShieldOff } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Input,
  ScrollView,
  Sheet,
  Spinner,
  Text,
  TextArea,
  View,
  XStack,
  YStack,
} from 'tamagui';

import {
  type DeletionRequestRow,
  useCancelDeletion,
  useDeletionRequest,
  useRequestDeletion,
} from '@/features/auth/hooks/useDeletionRequest';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';

const CONFIRM_KEYWORD = 'SUPPRIMER';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Écran "demande déjà en cours" ────────────────────────────────────────
function PendingDeletionView({ request }: { request: DeletionRequestRow }) {
  const t = useTranslations();
  const da = t.profileScreens.deleteAccount;
  const cancelDeletion = useCancelDeletion();
  const scheduledDate = formatDate(request.scheduled_delete_at);

  const handleCancel = useCallback(async () => {
    try {
      await cancelDeletion.mutateAsync();
      Alert.alert(da.cancelledTitle, da.cancelledMessage);
    } catch (err) {
      logger.warn('Cancel deletion failed', { message: (err as Error).message });
      Alert.alert(da.errorTitle, da.cancelFailedMessage);
    }
  }, [cancelDeletion, da]);

  return (
    <YStack gap="$4" paddingTop="$3">
      <YStack
        backgroundColor="$surface"
        borderRadius="$lg"
        padding="$4"
        gap="$3"
        borderWidth={1}
        borderColor="$danger"
      >
        <XStack gap="$3" alignItems="center">
          <AlertTriangle size={24} color="#FF3B30" />
          <Text color="$danger" fontSize={16} fontWeight="700">
            {da.scheduledTitle}
          </Text>
        </XStack>
        <Text color="$color" fontSize={15} lineHeight={22}>
          {da.scheduledBefore}
          <Text fontWeight="700">{scheduledDate}</Text>.
        </Text>
        <Text color="$textSecondary" fontSize={13} lineHeight={20}>
          {da.scheduledHint}
        </Text>
      </YStack>

      {request.reason ? (
        <YStack backgroundColor="$surface" borderRadius="$lg" padding="$4" gap="$2">
          <Text color="$textSecondary" fontSize={12} fontWeight="700" textTransform="uppercase">
            {da.reasonGiven}
          </Text>
          <Text color="$color" fontSize={14} lineHeight={20}>
            {request.reason}
          </Text>
        </YStack>
      ) : null}

      <Button
        onPress={() => void handleCancel()}
        disabled={cancelDeletion.isPending}
        backgroundColor="$accentNeon"
        color="#000000"
        borderRadius="$lg"
        height={50}
        fontWeight="800"
        fontSize={15}
        pressStyle={{ opacity: 0.85, scale: 0.98 }}
      >
        {cancelDeletion.isPending ? <Spinner color="#000000" /> : da.cancelRequestButton}
      </Button>
    </YStack>
  );
}

// ─── Écran "demander la suppression" ──────────────────────────────────────
function RequestDeletionView() {
  const t = useTranslations();
  const da = t.profileScreens.deleteAccount;
  const requestDeletion = useRequestDeletion();
  const { logout } = useLogout();
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  const canConfirm = confirmInput.trim().toUpperCase() === CONFIRM_KEYWORD;

  const handleConfirm = useCallback(async () => {
    try {
      await requestDeletion.mutateAsync(reason.trim() || null);
      setConfirmOpen(false);
      // Logout + redirect — le guard renvoie vers /welcome.
      await logout();
      // Le message info à l'user (date de suppression effective).
      Alert.alert(da.requestRecordedTitle, da.requestRecordedMessage);
    } catch (err) {
      logger.warn('Request deletion failed', { message: (err as Error).message });
      Alert.alert(da.errorTitle, da.requestFailedMessage);
    }
  }, [requestDeletion, reason, logout, da]);

  return (
    <YStack gap="$4" paddingTop="$3">
      {/* Warning banner */}
      <YStack
        backgroundColor="$surface"
        borderRadius="$lg"
        padding="$4"
        gap="$2"
        borderWidth={1}
        borderColor="$danger"
      >
        <XStack gap="$3" alignItems="center">
          <AlertTriangle size={22} color="#FF3B30" />
          <Text color="$danger" fontSize={15} fontWeight="700">
            {da.irreversibleTitle}
          </Text>
        </XStack>
        <Text color="$color" fontSize={14} lineHeight={20}>
          {da.irreversibleMessage}
        </Text>
      </YStack>

      {/* Liste de ce qui sera supprimé */}
      <YStack backgroundColor="$surface" borderRadius="$lg" padding="$4" gap="$3">
        <Text color="$textSecondary" fontSize={12} fontWeight="700" textTransform="uppercase">
          {da.whatWillBeDeleted}
        </Text>
        <YStack gap="$2">
          {da.deletedItems.map((item) => (
            <XStack key={item} gap="$2" alignItems="flex-start">
              <Text color="$textSecondary" fontSize={14}>
                •
              </Text>
              <Text color="$color" fontSize={14} flex={1} lineHeight={20}>
                {item}
              </Text>
            </XStack>
          ))}
        </YStack>
      </YStack>

      {/* Raison (optionnelle) */}
      <YStack gap="$2">
        <Text color="$textSecondary" fontSize={13} fontWeight="700">
          {da.reasonLabel}
        </Text>
        <TextArea
          value={reason}
          onChangeText={(text) => setReason(text.slice(0, 500))}
          placeholder={da.reasonPlaceholder}
          placeholderTextColor="$placeholderColor"
          minHeight={90}
          maxLength={500}
          backgroundColor="$surface"
          borderColor="$borderColor"
          borderWidth={1}
          borderRadius="$lg"
          color="$color"
          fontSize={14}
          padding="$3"
        />
        <Text color="$placeholderColor" fontSize={11} textAlign="right">
          {reason.length}/500
        </Text>
      </YStack>

      <Button
        onPress={() => setConfirmOpen(true)}
        backgroundColor="$danger"
        color="#FFFFFF"
        borderRadius="$lg"
        height={50}
        fontWeight="800"
        fontSize={15}
        pressStyle={{ opacity: 0.85, scale: 0.98 }}
      >
        {da.requestButton}
      </Button>

      {/* Modal de confirmation à 2 étapes */}
      <Sheet
        modal
        open={confirmOpen}
        onOpenChange={(open: boolean) => {
          setConfirmOpen(open);
          if (!open) setConfirmInput('');
        }}
        snapPoints={[50]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay backgroundColor="rgba(0,0,0,0.72)" />
        <Sheet.Frame
          backgroundColor="$surface"
          borderTopLeftRadius="$lg"
          borderTopRightRadius="$lg"
          padding="$5"
          gap="$4"
        >
          <Sheet.Handle backgroundColor="$borderColor" />

          <YStack alignItems="center" gap="$2">
            <ShieldOff size={36} color="#FF3B30" />
            <Text color="$color" fontSize={18} fontWeight="800" textAlign="center">
              {da.sureTitle}
            </Text>
          </YStack>

          <Text color="$textSecondary" fontSize={14} textAlign="center" lineHeight={20}>
            {da.confirmBefore}
            <Text color="$danger" fontWeight="700">
              {CONFIRM_KEYWORD}
            </Text>
            {da.confirmAfter}
          </Text>

          <Input
            value={confirmInput}
            onChangeText={setConfirmInput}
            placeholder={CONFIRM_KEYWORD}
            placeholderTextColor="$placeholderColor"
            autoCapitalize="characters"
            autoCorrect={false}
            backgroundColor="$background"
            borderColor={canConfirm ? '$danger' : '$borderColor'}
            borderWidth={1}
            borderRadius="$lg"
            color="$color"
            fontSize={16}
            fontWeight="700"
            textAlign="center"
            height={48}
          />

          <XStack gap="$3">
            <Button
              flex={1}
              onPress={() => {
                setConfirmOpen(false);
                setConfirmInput('');
              }}
              backgroundColor="transparent"
              borderColor="$borderColor"
              borderWidth={1}
              color="$color"
              borderRadius="$lg"
              height={48}
              fontWeight="600"
              fontSize={14}
              pressStyle={{ opacity: 0.7 }}
            >
              {t.profileScreens.common.cancel}
            </Button>
            <Button
              flex={1}
              onPress={() => void handleConfirm()}
              disabled={!canConfirm || requestDeletion.isPending}
              backgroundColor="$danger"
              color="#FFFFFF"
              borderRadius="$lg"
              height={48}
              fontWeight="800"
              fontSize={14}
              opacity={!canConfirm || requestDeletion.isPending ? 0.45 : 1}
              pressStyle={{ opacity: 0.85, scale: 0.98 }}
            >
              {requestDeletion.isPending ? <Spinner color="#FFFFFF" /> : da.confirmDelete}
            </Button>
          </XStack>
        </Sheet.Frame>
      </Sheet>
    </YStack>
  );
}

// ─── Écran principal ───────────────────────────────────────────────────────
export default function DeleteAccountScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const deletionRequestQuery = useDeletionRequest();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        {/* Header */}
        <XStack
          height={56}
          paddingHorizontal="$4"
          alignItems="center"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderColor"
        >
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text
            flex={1}
            marginLeft="$3"
            color="$danger"
            fontSize={18}
            fontWeight="700"
            fontFamily="$heading"
          >
            {t.profileScreens.deleteAccount.title}
          </Text>
          <View width={24} />
        </XStack>

        <ScrollView
          flex={1}
          backgroundColor="$background"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <YStack width="100%" maxWidth={430} alignSelf="center">
            {deletionRequestQuery.isLoading ? (
              <YStack paddingVertical={80} alignItems="center">
                <Spinner size="large" color="$color" />
              </YStack>
            ) : deletionRequestQuery.data ? (
              <PendingDeletionView request={deletionRequestQuery.data} />
            ) : (
              <RequestDeletionView />
            )}
          </YStack>
        </ScrollView>
      </YStack>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
});
