import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ScrollView, Text, XStack, YStack } from 'tamagui';

import {
  CGV_CURRENT_VERSION,
  CGV_EN_TITLE,
  CGV_EN_UPDATED_AT,
  CGV_FR_TITLE,
  CGV_FR_UPDATED_AT,
  cgvEnSections,
  cgvFrSections,
  type LegalSection,
} from '@/features/legal/content/cgv';

const logoSource = require('../../assets/Logo-Doumassi.webp') as number;

function SectionList({ sections }: { sections: LegalSection[] }) {
  return (
    <YStack gap="$4">
      {sections.map((section) => (
        <YStack key={section.title} gap="$2">
          <Text color="$color" fontSize={16} fontWeight="700" lineHeight={22}>
            {section.title}
          </Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph} color="$textSecondary" fontSize={14} lineHeight={21}>
              {paragraph}
            </Text>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

export default function TermsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <YStack flex={1} backgroundColor="$background">
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$3"
          paddingVertical="$3"
          borderBottomWidth={1}
          borderBottomColor="$borderColor"
        >
          <Button
            id="terms-back-button"
            onPress={() => router.back()}
            circular
            size="$3"
            chromeless
            pressStyle={{ opacity: 0.65 }}
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={26} color="#FFFFFF" />
          </Button>
          <Text color="$color" fontSize={18} fontWeight="700" fontFamily="$heading">
            Terms & Conditions
          </Text>
          <YStack width={40} height={40} />
        </XStack>

        <ScrollView
          flex={1}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: 36,
          }}
          showsVerticalScrollIndicator
        >
          <YStack width="100%" maxWidth={720} alignSelf="center" gap="$6">
            <YStack alignItems="center" gap="$2">
              <Image
                source={logoSource}
                style={{ width: 56, height: 56 }}
                contentFit="contain"
                accessibilityLabel="Logo DOUMASSI"
              />
              <Text color="$textSecondary" fontSize={12}>
                Version {CGV_CURRENT_VERSION}
              </Text>
            </YStack>

            <YStack gap="$3">
              <Text color="$color" fontSize={22} fontWeight="800" lineHeight={28}>
                {CGV_FR_TITLE}
              </Text>
              <Text color="$textSecondary" fontSize={13}>
                Application DOUMASSI (D) — Dernière mise à jour : {CGV_FR_UPDATED_AT}
              </Text>
            </YStack>
            <SectionList sections={cgvFrSections} />

            <YStack height={1} backgroundColor="$borderColor" marginVertical="$2" />

            <YStack gap="$3">
              <Text color="$color" fontSize={22} fontWeight="800" lineHeight={28}>
                {CGV_EN_TITLE}
              </Text>
              <Text color="$textSecondary" fontSize={13}>
                DOUMASSI (D) application - Last updated: {CGV_EN_UPDATED_AT}
              </Text>
            </YStack>
            <SectionList sections={cgvEnSections} />
          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
