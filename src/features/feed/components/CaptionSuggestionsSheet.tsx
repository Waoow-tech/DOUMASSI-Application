// CaptionSuggestionsSheet — E5-14.
//
// Bottom sheet présentant les 3 suggestions de légende IA. Purement présentatif :
// piloté par l'état de la mutation useSuggestCaption passé en props (loading /
// erreur / suggestions). Tap sur une suggestion → l'insère dans le composer.

import { RefreshCw, Sparkles } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';
import { Sheet, Text, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

export interface CaptionSuggestionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  isError: boolean;
  /** Code d'erreur remonté par la mutation (ex. `quota_exceeded`). */
  errorCode: string | null;
  suggestions: string[];
  onPick: (caption: string) => void;
  onRegenerate: () => void;
}

export function CaptionSuggestionsSheet({
  open,
  onOpenChange,
  isPending,
  isError,
  errorCode,
  suggestions,
  onPick,
  onRegenerate,
}: CaptionSuggestionsSheetProps) {
  const t = useTranslations();
  const c = t.feed.createPost.aiCaption;
  const isQuota = errorCode === 'quota_exceeded';

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[60]} dismissOnSnapToBottom>
      <Sheet.Overlay
        animation="lazy"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(0,0,0,0.55)"
      />
      <Sheet.Handle />
      <Sheet.Frame
        backgroundColor="$background"
        borderTopLeftRadius={20}
        borderTopRightRadius={20}
        padding="$4"
        gap="$3"
      >
        <XStack alignItems="center" gap="$2">
          <Sparkles size={18} color="#FFFFFF" />
          <Text flex={1} fontSize={17} fontWeight="700" color="$color">
            {c.sheetTitle}
          </Text>
        </XStack>

        {isPending ? (
          <YStack paddingVertical="$6" alignItems="center" gap="$3">
            <ActivityIndicator color="#FFFFFF" />
            <Text color="$textSecondary" fontSize={14}>
              {c.loading}
            </Text>
          </YStack>
        ) : isError ? (
          <YStack paddingVertical="$4" gap="$3">
            <Text color="$color" fontSize={15} fontWeight="700">
              {c.errorTitle}
            </Text>
            <Text color="$textSecondary" fontSize={14}>
              {isQuota ? c.errorQuota : c.errorGeneric}
            </Text>
            {!isQuota ? (
              <XStack
                onPress={onRegenerate}
                alignItems="center"
                gap="$2"
                alignSelf="flex-start"
                paddingVertical="$2"
                pressStyle={{ opacity: 0.6 }}
                accessibilityRole="button"
                accessibilityLabel={c.regenerate}
              >
                <RefreshCw size={16} color="#FFFFFF" />
                <Text color="$color" fontSize={14} fontWeight="700">
                  {c.regenerate}
                </Text>
              </XStack>
            ) : null}
          </YStack>
        ) : (
          <YStack gap="$2">
            <Text color="$textSecondary" fontSize={13}>
              {c.sheetSubtitle}
            </Text>
            {suggestions.map((s, i) => (
              <YStack
                key={i}
                onPress={() => onPick(s)}
                backgroundColor="$surface"
                borderRadius={12}
                padding="$3"
                pressStyle={{ opacity: 0.7 }}
                accessibilityRole="button"
                accessibilityLabel={c.a11ySuggestion(s)}
              >
                <Text color="$color" fontSize={15} lineHeight={21}>
                  {s}
                </Text>
              </YStack>
            ))}
            <XStack
              onPress={onRegenerate}
              alignItems="center"
              gap="$2"
              alignSelf="flex-start"
              paddingVertical="$2"
              marginTop="$1"
              pressStyle={{ opacity: 0.6 }}
              accessibilityRole="button"
              accessibilityLabel={c.regenerate}
            >
              <RefreshCw size={16} color="#A0A0A0" />
              <Text color="$textSecondary" fontSize={14} fontWeight="700">
                {c.regenerate}
              </Text>
            </XStack>
          </YStack>
        )}
      </Sheet.Frame>
    </Sheet>
  );
}
