import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Trash2, type LucideIcon } from 'lucide-react-native';
import { Alert } from 'react-native';
import { Button, Sheet, Text, XStack, YStack } from 'tamagui';

export type PostMenuSheetProps = {
  postId: string;
  isAuthor: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare?: () => void;
  onHidden?: () => void;
  onDelete?: () => Promise<void> | void;
  onDeleted?: () => void;
  onReported?: () => void;
  onCopyLink?: () => void;
};

const HIDDEN_POSTS_STORAGE_KEY = 'doumassi:hidden_posts';

export function PostMenuSheet({
  postId,
  isAuthor,
  open,
  onOpenChange,
  onShare,
  onHidden,
  onDelete,
  onDeleted,
  onReported,
  onCopyLink,
}: PostMenuSheetProps) {
  const close = () => onOpenChange(false);

  const handleShare = () => {
    close();
    onShare?.();
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(`doumassi://post/${postId}`);
    close();
    onCopyLink?.();
    Alert.alert('Lien copié', 'Le lien du post est prêt à être partagé.');
  };

  const handleHide = async () => {
    const rawHiddenPosts = await AsyncStorage.getItem(HIDDEN_POSTS_STORAGE_KEY);
    const hiddenPosts = rawHiddenPosts ? (JSON.parse(rawHiddenPosts) as string[]) : [];
    const nextHiddenPosts = Array.from(new Set([...hiddenPosts, postId]));

    await AsyncStorage.setItem(HIDDEN_POSTS_STORAGE_KEY, JSON.stringify(nextHiddenPosts));
    close();
    onHidden?.();
  };

  const handleReport = () => {
    close();
    onReported?.();
    Alert.alert('Signalement', 'Cette action sera disponible au Sprint 4.');
  };

  const handleDelete = () => {
    if (!onDelete) return;

    Alert.alert(
      'Supprimer ce post ?',
      'Cette action est irréversible. Le post sera retiré du feed.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
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
      ]
    );
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
          <MenuButton label="Partager" onPress={handleShare} />
          <MenuButton label="Copier le lien" onPress={() => void handleCopyLink()} />

          {isAuthor ? (
            <MenuButton label="Supprimer" danger Icon={Trash2} onPress={handleDelete} />
          ) : (
            <>
              <MenuButton label="Masquer ce post" onPress={() => void handleHide()} />
              <MenuButton label="Signaler" onPress={handleReport} />
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
        {Icon ? <Icon size={18} color={iconColor} /> : null}
        <Text color={danger ? '$danger' : '$color'} fontSize={15} fontWeight="500">
          {label}
        </Text>
      </XStack>
    </Button>
  );
}
