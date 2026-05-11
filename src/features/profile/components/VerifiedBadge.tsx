import { Text, XStack } from 'tamagui';

import { t } from '@/i18n';

export function VerifiedBadge({ isVerified }: { isVerified: boolean }) {
  if (!isVerified) return null;
  const copy = t.profile;
  return (
    <XStack
      backgroundColor="#3B82F6"
      paddingHorizontal={8}
      paddingVertical={2}
      borderRadius={12}
      alignItems="center"
      gap={4}
    >
      <Text fontSize={11} fontWeight="700" color="#FFFFFF">
        ✓ {copy.verifiedBadge}
      </Text>
    </XStack>
  );
}
