import { FlashList } from '@shopify/flash-list';
import { Send, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Sheet, Text, XStack, YStack } from 'tamagui';

import { CommentCard } from '@/features/comments/components/CommentCard';
import {
  type Comment,
  useComments,
  useCreateComment,
  useDeleteComment,
  useToggleCommentLike,
} from '@/features/comments/hooks/useComments';
import { supabase } from '@/lib/supabase';

type CommentsSheetProps = {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommentsSheet({ postId, open, onOpenChange }: CommentsSheetProps) {
  const insets = useSafeAreaInsets();
  const commentsQuery = useComments(postId);
  const createComment = useCreateComment(postId);
  const deleteComment = useDeleteComment(postId);
  const toggleLike = useToggleCommentLike(postId);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const comments = commentsQuery.data ?? [];
  const trimmedContent = content.trim();

  const countLabel = useMemo(() => {
    if (comments.length === 0) return '0';
    return String(comments.length);
  }, [comments.length]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setCurrentUserId(data.session?.user.id ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setReplyTo(null);
      setContent('');
    }
  }, [open]);

  const handleSend = async () => {
    if (!trimmedContent || createComment.isPending) return;

    await createComment.mutateAsync({
      content: trimmedContent,
      parentCommentId: replyTo?.id ?? null,
    });
    setContent('');
    setReplyTo(null);
  };

  const renderItem = ({ item }: { item: Comment }) => (
    <CommentCard
      comment={item}
      currentUserId={currentUserId}
      nested={Boolean(item.parent_comment_id)}
      onReply={setReplyTo}
      onDelete={(commentId) => deleteComment.mutate(commentId)}
      onToggleLike={(commentId) => toggleLike.mutate(commentId)}
    />
  );

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[82]}
      dismissOnSnapToBottom
      moveOnKeyboardChange
    >
      <Sheet.Overlay
        animation="lazy"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(0,0,0,0.58)"
      />
      <Sheet.Frame
        backgroundColor="$background"
        borderTopLeftRadius={18}
        borderTopRightRadius={18}
        overflow="hidden"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoiding}
        >
          <YStack flex={1}>
            <YStack
              paddingTop={10}
              paddingHorizontal={16}
              paddingBottom={10}
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderBottomColor="$borderColor"
            >
              <XStack justifyContent="center" marginBottom={10}>
                <YStack
                  width={38}
                  height={4}
                  borderRadius={2}
                  backgroundColor="$borderColorHover"
                />
              </XStack>

              <XStack alignItems="center">
                <XStack alignItems="baseline" gap={8} flex={1}>
                  <Text color="$color" fontSize={18} fontWeight="800">
                    Commentaires
                  </Text>
                  <Text color="$textSecondary" fontSize={13} fontWeight="700">
                    {countLabel}
                  </Text>
                </XStack>

                <Pressable
                  onPress={() => onOpenChange(false)}
                  hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer les commentaires"
                  style={styles.closeButton}
                >
                  <X size={20} color="#FFFFFF" />
                </Pressable>
              </XStack>
            </YStack>

            <View style={styles.listContainer}>
              {commentsQuery.isLoading ? (
                <YStack flex={1} alignItems="center" justifyContent="center">
                  <ActivityIndicator color="#FFFFFF" />
                </YStack>
              ) : (
                <FlashList
                  data={comments}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={commentsQuery.isRefetching}
                      onRefresh={() => void commentsQuery.refetch()}
                      tintColor="#FFFFFF"
                    />
                  }
                  ListEmptyComponent={
                    <YStack flex={1} alignItems="center" justifyContent="center" paddingTop={88}>
                      <Text color="$textSecondary" fontSize={15} fontWeight="600">
                        Soyez le premier à commenter !
                      </Text>
                    </YStack>
                  }
                />
              )}
            </View>

            <YStack
              borderTopWidth={StyleSheet.hairlineWidth}
              borderTopColor="$borderColor"
              paddingHorizontal={16}
              paddingTop={replyTo ? 8 : 12}
              paddingBottom={Math.max(insets.bottom, 12)}
              backgroundColor="$background"
              gap={8}
            >
              {replyTo ? (
                <XStack
                  alignItems="center"
                  gap={8}
                  backgroundColor="$surface"
                  borderRadius={8}
                  paddingHorizontal={10}
                  paddingVertical={8}
                >
                  <Text color="$textSecondary" fontSize={13} flex={1} numberOfLines={1}>
                    Réponse à @{replyTo.author_username}
                  </Text>
                  <Pressable
                    onPress={() => setReplyTo(null)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Annuler la réponse"
                  >
                    <X size={16} color="#A1A1AA" />
                  </Pressable>
                </XStack>
              ) : null}

              <XStack alignItems="flex-end" gap={10}>
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  placeholder="Ajouter un commentaire..."
                  placeholderTextColor="#8E8E93"
                  multiline
                  maxLength={500}
                  style={styles.input}
                  returnKeyType="default"
                />

                <Button
                  width={42}
                  height={42}
                  borderRadius={999}
                  padding={0}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={trimmedContent ? '#10D970' : '$surfaceElevated'}
                  disabled={!trimmedContent || createComment.isPending}
                  onPress={() => void handleSend()}
                  pressStyle={{ opacity: 0.86, scale: 0.98 }}
                >
                  {createComment.isPending ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <Send size={18} color={trimmedContent ? '#000000' : '#8E8E93'} />
                  )}
                </Button>
              </XStack>
            </YStack>
          </YStack>
        </KeyboardAvoidingView>
      </Sheet.Frame>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 10,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 12,
  },
});
