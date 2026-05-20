import type { LucideIcon } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';

type FeedTabPlaceholderProps = {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  manifest?: string;
};

export function FeedTabPlaceholder({ Icon, title, subtitle, manifest }: FeedTabPlaceholderProps) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$6" gap="$3">
      <Icon size={64} color="#6F6F6F" strokeWidth={1.6} />
      <Text color="$color" fontSize={18} fontWeight="700" textAlign="center">
        {title}
      </Text>
      <Text color="$textSecondary" fontSize={14} lineHeight={20} textAlign="center">
        {subtitle}
      </Text>
      {manifest ? (
        <Text
          color="$textSecondary"
          fontSize={13}
          lineHeight={20}
          textAlign="center"
          marginTop="$2"
        >
          {manifest}
        </Text>
      ) : null}
    </YStack>
  );
}
