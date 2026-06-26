import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import type { FeedStory } from '@/features/feed/hooks/useFeedStories';

type FeedStoriesProps = {
  stories: FeedStory[];
  onStoryPress: (story: FeedStory) => void;
};

export function FeedStories({ stories, onStoryPress }: FeedStoriesProps) {
  if (stories.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {stories.map((story) => (
        <YStack
          key={story.id}
          width={72}
          alignItems="center"
          gap={6}
          onPress={() => onStoryPress(story)}
          pressStyle={{ scale: 0.97, opacity: 0.85 }}
          accessibilityRole="button"
          accessibilityLabel={
            story.isMe ? 'Ajouter à votre story' : `Ouvrir la story de @${story.username}`
          }
          accessibilityHint={
            story.isMe
              ? 'Tap pour créer une nouvelle story'
              : `Tap pour visionner la story de @${story.username}`
          }
        >
          <YStack
            width={72}
            height={72}
            borderRadius={9999}
            padding={story.hasUnseenStory ? 2 : 0}
            backgroundColor={story.hasUnseenStory ? '#10D970' : 'transparent'}
            alignItems="center"
            justifyContent="center"
          >
            <YStack
              width={story.hasUnseenStory ? 68 : 72}
              height={story.hasUnseenStory ? 68 : 72}
              borderRadius={9999}
              backgroundColor="$surface"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
            >
              {story.avatar_url ? (
                <Image
                  source={{ uri: story.avatar_url }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <Text color="$color" fontSize={22} fontWeight="700">
                  {story.username.charAt(0).toUpperCase()}
                </Text>
              )}
            </YStack>

            {story.isMe ? (
              <XStack
                position="absolute"
                right={0}
                bottom={0}
                width={22}
                height={22}
                borderRadius={9999}
                backgroundColor="$accentNeon"
                borderWidth={2}
                borderColor="$background"
                alignItems="center"
                justifyContent="center"
              >
                <Plus size={14} color="#000000" strokeWidth={2.8} />
              </XStack>
            ) : null}
          </YStack>

          <Text color="$textSecondary" fontSize={11} numberOfLines={1} maxWidth={72}>
            {story.isMe ? 'Votre story' : story.username}
          </Text>
        </YStack>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: '100%',
    height: '100%',
  },
  content: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
