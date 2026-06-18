import { ExternalLink, Send } from 'lucide-react-native';
import { Button, Sheet, Text, XStack, YStack } from 'tamagui';

type InternalShareOptionsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShareOutside: () => void;
  onShareInside: () => void;
};

export function InternalShareOptionsSheet({
  open,
  onOpenChange,
  onShareOutside,
  onShareInside,
}: InternalShareOptionsSheetProps) {
  const close = () => onOpenChange(false);

  const handleShareOutside = () => {
    close();
    onShareOutside();
  };

  const handleShareInside = () => {
    close();
    onShareInside();
  };

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[24]} dismissOnSnapToBottom>
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
          <ShareOption
            label="Partager hors DOUMASSI"
            icon={<ExternalLink size={20} color="#FFFFFF" />}
            onPress={handleShareOutside}
          />
          <ShareOption
            label="Envoyer dans DOUMASSI"
            icon={<Send size={20} color="#FFFFFF" />}
            onPress={handleShareInside}
          />
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

function ShareOption({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
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
        {icon}
        <Text color="$color" fontSize={15} fontWeight="500">
          {label}
        </Text>
      </XStack>
    </Button>
  );
}
