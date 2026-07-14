// Tab Hash — placeholder Doumassi AI, vrai écran livré en Sprint 5-6.

import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Text, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

export default function StudioAIRoute() {
  const t = useTranslations();

  return (
    <View style={styles.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" paddingHorizontal="$6">
        <Sparkles size={64} color="#A0A0A0" strokeWidth={1.5} />
        <Text color="$color" fontSize={18} fontWeight="700" textAlign="center">
          {t.common.studioAi.comingSoonTitle}
        </Text>
        <Text color="$textSecondary" fontSize={14} textAlign="center">
          {t.common.studioAi.comingSoonSubtitle}
        </Text>
      </YStack>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
