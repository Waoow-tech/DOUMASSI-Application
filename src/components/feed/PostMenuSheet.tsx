import * as Clipboard from 'expo-clipboard';
import { EyeOff, Trash2, type LucideIcon } from 'lucide-react-native';
import { Alert } from 'react-native';
import { Button, Sheet, Text, XStack, YStack } from 'tamagui';

import { useHidePost } from '@/features/feed/hooks/useHiddenPosts';
import { useTranslations } from '@/i18n';

export type PostMenuSheetProps = {
  postId: string;
  isAuthor: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare?: () => void;
  onHidden?: () => void;
  onHideError?: () => void;
  onDelete?: () => Promise<void> | void;
  onDeleted?: () => void;
  onReported?: () => void;
  onCopyLink?: () => void;
};

export function PostMenuSheet({
  postId,
  isAuthor,
  open,
  onOpenChange,
  onShare,
  onHidden,
  onHideError,
  onDelete,
  onDeleted,
  onReported,
  onCopyLink,
}: PostMenuSheetProps) {
  const t = useTranslations();
  const hidePostMutation = useHidePost();
  const close = () => onOpenChange(false);

  const handleShare = () => {
    close();
    onShare?.();
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(`https://doumassi.app/post/${postId}`);
    close();
    onCopyLink?.();
    Alert.alert(t.feed.postMenu.linkCopiedTitle, t.feed.postMenu.linkCopiedMessage);
  };

  const handleHide = async () => {
    try {
      await hidePostMutation.mutateAsync(postId);
    } catch {
      onHideError?.();
      throw new Error('Hide post failed');
    }

    close();
    onHidden?.();
  };

  const handleReport = () => {
    close();
    onReported?.();
    Alert.alert(t.feed.postMenu.reportTitle, t.feed.postMenu.reportMessage);
  };

  const handleDelete = () => {
    if (!onDelete) return;

    Alert.alert(t.feed.postMenu.deleteTitle, t.feed.postMenu.deleteMessage, [
      { text: t.feed.postMenu.cancel, style: 'cancel' },
      {
        text: t.feed.postMenu.deleteConfirm,
        style: 'destructive',
        onPress: async () => {
          try {
            await onDelete();
          } catch {
            return;
          }

          close();
          onDeleted?.();
        },
      },
    ]);
  };

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[isAuthor ? 32 : 42]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay
        animation="lazy"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(0,0,0,0.5)"
      />
      <Sheet.Frame
        backgroundColor="$surface"
        borderTopLeftRadius={16}
        borderTopRightRadius={16}
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$5"
      >
        <XStack justifyContent="center" marginBottom="$3">
          <YStack width={36} height={4} borderRadius={2} backgroundColor="$borderColorHover" />
        </XStack>

        <YStack gap="$1">
          <MenuButton label={t.feed.postMenu.share} onPress={handleShare} />
          <MenuButton label={t.feed.postMenu.copyLink} onPress={() => void handleCopyLink()} />

          {isAuthor ? (
            <MenuButton
              label={t.feed.postMenu.delete}
              danger
              Icon={Trash2}
              onPress={handleDelete}
            />
          ) : (
            <>
              <MenuButton
                label={t.feed.postMenu.hide}
                Icon={EyeOff}
                onPress={() => void handleHide()}
              />
              <MenuButton label={t.feed.postMenu.report} onPress={handleReport} />
            </>
          )}
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

function MenuButton({
  label,
  danger = false,
  Icon,
  onPress,
}: {
  label: string;
  danger?: boolean;
  Icon?: LucideIcon;
  onPress: () => void;
}) {
  const iconColor = danger ? '#FF3B30' : '#FFFFFF';

  return (
    <Button
      backgroundColor="transparent"
      height={48}
      justifyContent="flex-start"
      paddingHorizontal="$3"
      borderRadius="$md"
      onPress={onPress}
      pressStyle={{ backgroundColor: '$surfaceElevated' }}
    >
      <XStack alignItems="center" gap={10}>
        {Icon ? <Icon size={20} color={iconColor} /> : null}
        <Text color={danger ? '$danger' : '$color'} fontSize={15} fontWeight="500">
          {label}
        </Text>
      </XStack>
    </Button>
  );
}
