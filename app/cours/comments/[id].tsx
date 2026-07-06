// Écran Entraide (commentaires d'une ressource) — E9-16 (#276)
//
// Liste des commentaires + composer. Suppression possible de son propre
// commentaire (la RLS autorise aussi l'auteur de la ressource à modérer, mais
// on n'affiche le bouton delete que pour ses propres commentaires ici — la
// modération owner passera par un écran admin plus tard).

import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Text, View, XStack, YStack } from 'tamagui';

import {
  useAddComment,
  useDeleteComment,
  useResourceComments,
  type ResourceComment,
} from '@/features/cours/hooks/useResourceComments';
import { VerifiedBadge } from '@/features/profile/components/VerifiedBadge';
import { supabase } from '@/lib/supabase';

function relative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.floor(Math.max(0, Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `${j} j`;
  return `${Math.floor(j / 7)} sem`;
}

export default function ResourceCommentsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const resourceId = typeof params.id === 'string' ? params.id : null;

  const { data: comments, isLoading } = useResourceComments(resourceId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();

  const [draft, setDraft] = useState('');
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setMeId(data.session?.user.id ?? null);
    })();
  }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/cours');
  }, []);

  const handleSend = useCallback(() => {
    const content = draft.trim();
    if (!resourceId || content.length === 0 || addComment.isPending) return;
    addComment.mutate(
      { resourceId, content },
      {
        onSuccess: () => setDraft(''),
        onError: (err) => Alert.alert('Erreur', err.message || 'Réessaie.'),
      }
    );
  }, [draft, resourceId, addComment]);

  const handleDelete = useCallback(
    (commentId: string) => {
      if (!resourceId) return;
      Alert.alert('Supprimer ce commentaire ?', undefined, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteComment.mutate({ commentId, resourceId }),
        },
      ]);
    },
    [deleteComment, resourceId]
  );

  const renderItem = useCallback(
    ({ item }: { item: ResourceComment }) => {
      const initial = (item.author_username || '?').charAt(0).toUpperCase();
      const isMine = meId !== null && item.author_id === meId;
      return (
        <XStack paddingHorizontal={16} paddingVertical={10} gap={10} alignItems="flex-start">
          <YStack
            width={36}
            height={36}
            borderRadius={9999}
            backgroundColor="$surfaceElevated"
            overflow="hidden"
            alignItems="center"
            justifyContent="center"
          >
            {item.author_avatar_url ? (
              <Image
                source={{ uri: item.author_avatar_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <Text fontSize={15} fontWeight="700" color="$color">
                {initial}
              </Text>
            )}
          </YStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <XStack alignItems="center" gap={4}>
              <Text fontSize={13} fontWeight="700" color="$color" numberOfLines={1}>
                @{item.author_username}
              </Text>
              <VerifiedBadge isVerified={item.author_is_verified} />
              <Text fontSize={11} color="$textSecondary">
                · {relative(item.created_at)}
              </Text>
            </XStack>
            <Text fontSize={14} color="$color" lineHeight={19}>
              {item.content}
            </Text>
          </YStack>
          {isMine ? (
            <Pressable
              onPress={() => handleDelete(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Supprimer mon commentaire"
            >
              <Trash2 size={15} color="#A0A0A0" />
            </Pressable>
          ) : null}
        </XStack>
      );
    },
    [meId, handleDelete]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
          <XStack
            height={56}
            paddingHorizontal={12}
            alignItems="center"
            gap={12}
            borderBottomWidth={StyleSheet.hairlineWidth}
            borderBottomColor="$borderColor"
          >
            <Pressable
              onPress={handleBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Retour"
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </Pressable>
            <Text flex={1} color="$color" fontSize={18} fontWeight="700">
              Entraide
            </Text>
          </XStack>

          <View flex={1}>
            {isLoading ? (
              <YStack flex={1} alignItems="center" justifyContent="center">
                <ActivityIndicator color="#FFFFFF" />
              </YStack>
            ) : (comments?.length ?? 0) === 0 ? (
              <YStack
                flex={1}
                alignItems="center"
                justifyContent="center"
                paddingHorizontal={24}
                gap={6}
              >
                <Text fontSize={15} fontWeight="700" color="$color">
                  Aucun commentaire
                </Text>
                <Text fontSize={13} color="$textSecondary" textAlign="center">
                  Pose une question ou partage une remarque sur cette ressource.
                </Text>
              </YStack>
            ) : (
              <FlashList
                data={comments ?? []}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>

          {/* Composer */}
          <XStack
            paddingHorizontal={12}
            paddingTop={8}
            paddingBottom={insets.bottom + 8}
            gap={8}
            alignItems="flex-end"
            borderTopWidth={StyleSheet.hairlineWidth}
            borderTopColor="$borderColor"
            backgroundColor="$background"
          >
            <Input
              flex={1}
              value={draft}
              onChangeText={setDraft}
              placeholder="Écrire un commentaire…"
              placeholderTextColor="$placeholderColor"
              multiline
              maxLength={2000}
              color="$color"
              backgroundColor="$surface"
              borderWidth={0}
              borderRadius="$md"
              minHeight={44}
              maxHeight={120}
              paddingHorizontal={14}
              paddingTop={12}
              accessibilityLabel="Écrire un commentaire"
            />
            <Pressable
              onPress={handleSend}
              disabled={draft.trim().length === 0 || addComment.isPending}
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    draft.trim().length > 0 && !addComment.isPending ? '#10D970' : '#1A1A1A',
                },
              ]}
            >
              {addComment.isPending ? (
                <ActivityIndicator color="#10D970" size="small" />
              ) : (
                <Send
                  size={18}
                  color={draft.trim().length > 0 ? '#000000' : '#666'}
                  strokeWidth={2.2}
                />
              )}
            </Pressable>
          </XStack>
        </YStack>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: '100%',
    height: '100%',
  },
  flex: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
