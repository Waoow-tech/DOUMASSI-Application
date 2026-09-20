// AiToolsSheet — E5-18 (Tools).
//
// Bottom sheet regroupant 2 outils rapides du Studio AI :
//   - Calculatrice : évaluation locale via mathjs (pas d'appel réseau, instantané)
//   - Traducteur   : appel de l'Edge Function ai-translate (quota partagé 20/j)

import { useState } from 'react';
import { Button, Input, Sheet, Text, TextArea, XStack, YStack } from 'tamagui';

import { useTranslate } from '@/features/ai/hooks/useTranslate';
import { calculate, type CalcResult } from '@/features/ai/lib/calculator';
import { useTranslations } from '@/i18n';

export interface AiToolsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiToolsSheet({ open, onOpenChange }: AiToolsSheetProps) {
  const t = useTranslations();
  const tt = t.ai.tools;

  // --- Calculatrice (locale) ---
  const [calcExpr, setCalcExpr] = useState('');
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const runCalc = () => setCalcResult(calculate(calcExpr));

  // --- Traducteur (Edge Function) ---
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState(tt.langs.en);
  const translate = useTranslate();
  const runTranslate = () => {
    if (text.trim().length === 0 || translate.isPending) return;
    translate.mutate({ text: text.trim(), targetLang });
  };
  const translateErr = translate.error instanceof Error ? translate.error.message : null;

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[85]} dismissOnSnapToBottom>
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
        gap="$4"
      >
        {/* Calculatrice */}
        <YStack gap="$2">
          <Text fontSize={16} fontWeight="700" color="$color">
            {tt.calcTitle}
          </Text>
          <XStack gap="$2" alignItems="center">
            <Input
              flex={1}
              value={calcExpr}
              onChangeText={(v) => {
                setCalcExpr(v);
                setCalcResult(null);
              }}
              onSubmitEditing={runCalc}
              placeholder={tt.calcPlaceholder}
              placeholderTextColor="$placeholderColor"
              autoCapitalize="none"
              autoCorrect={false}
              color="$color"
            />
            <Button
              size="$4"
              onPress={runCalc}
              backgroundColor="$color"
              color="$background"
              fontWeight="800"
              paddingHorizontal="$4"
            >
              =
            </Button>
          </XStack>
          {calcResult?.ok ? (
            <Text fontSize={22} fontWeight="800" color="$color">
              {calcResult.result}
            </Text>
          ) : calcResult?.error === 'invalid' ? (
            <Text fontSize={13} color="$danger">
              {tt.calcErrorInvalid}
            </Text>
          ) : null}
        </YStack>

        <YStack height={1} backgroundColor="$borderColor" />

        {/* Traducteur */}
        <YStack gap="$2">
          <Text fontSize={16} fontWeight="700" color="$color">
            {tt.translateTitle}
          </Text>
          <TextArea
            value={text}
            onChangeText={setText}
            placeholder={tt.translatePlaceholder}
            placeholderTextColor="$placeholderColor"
            minHeight={70}
            color="$color"
          />
          <Text fontSize={12} color="$textSecondary">
            {tt.translateTargetLabel}
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {Object.values(tt.langs).map((lang) => (
              <Button
                key={lang}
                size="$2"
                onPress={() => setTargetLang(lang)}
                backgroundColor={targetLang === lang ? '$color' : '$surface'}
                color={targetLang === lang ? '$background' : '$color'}
                borderRadius="$10"
                fontWeight="700"
                aria-selected={targetLang === lang}
              >
                {lang}
              </Button>
            ))}
          </XStack>
          <Button
            size="$4"
            onPress={runTranslate}
            disabled={text.trim().length === 0 || translate.isPending}
            opacity={text.trim().length === 0 ? 0.5 : 1}
            backgroundColor="$color"
            color="$background"
            fontWeight="800"
          >
            {translate.isPending ? tt.translateLoading : tt.translateAction}
          </Button>
          {translate.isError ? (
            <Text fontSize={13} color="$danger">
              {translateErr === 'quota_exceeded'
                ? tt.translateErrorQuota
                : tt.translateErrorGeneric}
            </Text>
          ) : translate.data ? (
            <YStack backgroundColor="$surface" borderRadius={12} padding="$3">
              <Text fontSize={15} color="$color" lineHeight={21}>
                {translate.data}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}
