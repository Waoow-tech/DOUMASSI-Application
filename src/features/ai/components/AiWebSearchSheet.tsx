// AiWebSearchSheet — E5-17 (Recherche web).
//
// Feuille dédiée : l'utilisateur pose une question, l'Edge Function ai-web-search
// interroge Tavily puis fait synthétiser le LLM avec citations [n]. On affiche la
// réponse + la liste des sources (favicon + titre + domaine), cliquables.

import { Image } from 'expo-image';
import { ExternalLink } from 'lucide-react-native';
import { useState } from 'react';
import { Linking } from 'react-native';
import { Button, ScrollView, Sheet, Text, TextArea, XStack, YStack } from 'tamagui';

import { useWebSearch, type WebSearchSource } from '@/features/ai/hooks/useWebSearch';
import { useTranslations } from '@/i18n';

export interface AiWebSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Domaine lisible depuis une URL (fallback : l'URL brute). */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function faviconOf(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=64`;
}

function SourceRow({
  index,
  source,
  a11y,
}: {
  index: number;
  source: WebSearchSource;
  a11y: string;
}) {
  return (
    <XStack
      gap={10}
      alignItems="center"
      paddingVertical={8}
      onPress={() => void Linking.openURL(source.url)}
      pressStyle={{ opacity: 0.6 }}
      accessibilityRole="link"
      accessibilityLabel={`${a11y} ${index}: ${source.title}`}
    >
      <Text fontSize={12} fontWeight="800" color="$textSecondary" width={20}>
        {index}
      </Text>
      <Image
        source={{ uri: faviconOf(source.url) }}
        style={{ width: 20, height: 20, borderRadius: 4 }}
        contentFit="contain"
      />
      <YStack flex={1}>
        <Text fontSize={14} fontWeight="600" color="$color" numberOfLines={1}>
          {source.title}
        </Text>
        <Text fontSize={12} color="$textSecondary" numberOfLines={1}>
          {hostOf(source.url)}
        </Text>
      </YStack>
      <ExternalLink size={16} color="#A0A0A0" />
    </XStack>
  );
}

export function AiWebSearchSheet({ open, onOpenChange }: AiWebSearchSheetProps) {
  const t = useTranslations();
  const ws = t.ai.webSearch;
  const [query, setQuery] = useState('');
  const search = useWebSearch();

  const runSearch = () => {
    if (query.trim().length === 0 || search.isPending) return;
    search.mutate(query.trim());
  };

  const errCode = search.error instanceof Error ? search.error.message : null;
  const result = search.data;

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[88]} dismissOnSnapToBottom>
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
        <Text fontSize={16} fontWeight="700" color="$color">
          {ws.title}
        </Text>
        <Text fontSize={13} color="$textSecondary">
          {ws.subtitle}
        </Text>

        <TextArea
          value={query}
          onChangeText={setQuery}
          placeholder={ws.placeholder}
          placeholderTextColor="$placeholderColor"
          minHeight={64}
          color="$color"
        />
        <Button
          size="$4"
          onPress={runSearch}
          disabled={query.trim().length === 0 || search.isPending}
          opacity={query.trim().length === 0 ? 0.5 : 1}
          backgroundColor="$color"
          color="$background"
          fontWeight="800"
        >
          {search.isPending ? ws.loading : ws.action}
        </Button>

        {search.isError ? (
          <Text fontSize={13} color="$danger">
            {errCode === 'quota_exceeded' ? ws.errorQuota : ws.errorGeneric}
          </Text>
        ) : result ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {result.sources.length === 0 ? (
              <Text fontSize={14} color="$textSecondary">
                {ws.noResults}
              </Text>
            ) : (
              <YStack gap="$3" paddingBottom="$6">
                <Text fontSize={15} color="$color" lineHeight={22}>
                  {result.answer}
                </Text>
                <YStack height={1} backgroundColor="$borderColor" />
                <Text
                  fontSize={13}
                  fontWeight="700"
                  color="$textSecondary"
                  textTransform="uppercase"
                >
                  {ws.sourcesTitle}
                </Text>
                {result.sources.map((source, i) => (
                  <SourceRow
                    key={source.url}
                    index={i + 1}
                    source={source}
                    a11y={ws.openSourceA11y}
                  />
                ))}
              </YStack>
            )}
          </ScrollView>
        ) : null}
      </Sheet.Frame>
    </Sheet>
  );
}
