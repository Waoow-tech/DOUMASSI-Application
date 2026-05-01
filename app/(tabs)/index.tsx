// Home feed — placeholder screen.
// This is a temporary page to verify navigation after signup/login.
// Will be replaced with real feed content in a future sprint.

import { Text, YStack } from 'tamagui';

export default function HomeFeedScreen() {
  return (
    <YStack
      flex={1}
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$5"
      gap="$4"
    >
      <Text fontSize={32} fontWeight="700" color="$color" fontFamily="$heading">
        🏠 Home Feed
      </Text>

      <Text fontSize={16} color="$textSecondary" textAlign="center" lineHeight={24}>
        Welcome to DOUMASSI!{'\n'}This is a placeholder for the home feed.
      </Text>

      <YStack
        width="100%"
        maxWidth={360}
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$4"
        padding="$4"
        gap="$2"
      >
        <Text fontSize={14} color="$textSecondary">
          ✅ Signup flow complete
        </Text>
        <Text fontSize={14} color="$textSecondary">
          ✅ Email verification sent
        </Text>
        <Text fontSize={14} color="$textSecondary">
          ✅ Redirected to home feed
        </Text>
      </YStack>
    </YStack>
  );
}
