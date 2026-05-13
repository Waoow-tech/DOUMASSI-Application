// Modale de confirmation de blocage — E3-03.
// Affiche "Block @username?" avec un message explicatif et deux boutons :
// Cancel (transparent) et Block ($danger).
// Utilise Tamagui Sheet pour être cross-platform.

import { Button, Sheet, Text, XStack, YStack } from 'tamagui';

interface BlockConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  onConfirm: () => void;
  isPending?: boolean;
}

export function BlockConfirmModal({
  open,
  onOpenChange,
  username,
  onConfirm,
  isPending = false,
}: BlockConfirmModalProps) {
  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[35]} dismissOnSnapToBottom>
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
        paddingHorizontal="$5"
        paddingTop="$4"
        paddingBottom="$5"
      >
        {/* Poignée */}
        <XStack justifyContent="center" marginBottom="$4">
          <YStack width={36} height={4} borderRadius={2} backgroundColor="$borderColorHover" />
        </XStack>

        <Text fontSize={18} fontWeight="700" color="$color" textAlign="center" marginBottom="$2">
          Block @{username}?
        </Text>
        <Text
          fontSize={14}
          color="$textSecondary"
          textAlign="center"
          marginBottom="$4"
          lineHeight={20}
        >
          They won&apos;t be able to find your profile, posts or contact you. They won&apos;t be
          notified.
        </Text>

        <XStack gap="$3">
          <Button
            flex={1}
            height={44}
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="$borderColorHover"
            borderRadius="$lg"
            color="$color"
            fontWeight="600"
            fontSize={14}
            onPress={() => onOpenChange(false)}
            pressStyle={{ opacity: 0.7 }}
          >
            Cancel
          </Button>
          <Button
            flex={1}
            height={44}
            backgroundColor="$danger"
            borderRadius="$lg"
            color="#FFFFFF"
            fontWeight="700"
            fontSize={14}
            disabled={isPending}
            onPress={() => {
              onConfirm();
              onOpenChange(false);
            }}
            pressStyle={{ opacity: 0.85, scale: 0.98 }}
          >
            Block
          </Button>
        </XStack>
      </Sheet.Frame>
    </Sheet>
  );
}
