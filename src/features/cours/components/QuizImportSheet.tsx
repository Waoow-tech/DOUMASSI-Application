// QuizImportSheet — E9-12 (#272)
//
// "Colle tes questions" : bouton Copier le prompt (→ presse-papier), l'user
// va dans SON IA, revient coller le JSON, on parse + valide. En cas de succès
// on renvoie les questions à l'éditeur (E9-11) via onImport.

import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Sheet, Text, TextArea, XStack, YStack } from 'tamagui';

import { parseQuizImport, QUIZ_IMPORT_PROMPT, type ParsedQuizQuestion } from '../lib/quizImport';

export interface QuizImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (questions: ParsedQuizQuestion[]) => void;
}

export function QuizImportSheet({ open, onOpenChange, onImport }: QuizImportSheetProps) {
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = async () => {
    await Clipboard.setStringAsync(QUIZ_IMPORT_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    const result = parseQuizImport(pasted);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setPasted('');
    onImport(result.questions);
    onOpenChange(false);
  };

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
        paddingHorizontal={20}
        paddingTop={16}
        paddingBottom={28}
      >
        <YStack gap={14} flex={1}>
          <Text fontSize={18} fontWeight="800" color="$color">
            Importer depuis ton IA
          </Text>

          {/* Étape 1 */}
          <YStack gap={8}>
            <Text fontSize={13} color="$textSecondary">
              1. Copie ce prompt, colle-le dans ton IA (ChatGPT, etc.) avec ton cours.
            </Text>
            <Pressable
              onPress={() => void handleCopyPrompt()}
              accessibilityRole="button"
              accessibilityLabel="Copier le prompt"
              style={styles.copyBtn}
            >
              <XStack alignItems="center" justifyContent="center" gap={8}>
                {copied ? (
                  <Check size={16} color="#000000" strokeWidth={2.4} />
                ) : (
                  <Copy size={16} color="#000000" strokeWidth={2.2} />
                )}
                <Text fontSize={14} fontWeight="800" color="#000000">
                  {copied ? 'Prompt copié !' : 'Copier le prompt'}
                </Text>
              </XStack>
            </Pressable>
          </YStack>

          {/* Étape 2 */}
          <YStack gap={8} flex={1}>
            <Text fontSize={13} color="$textSecondary">
              2. Colle ici la réponse JSON de ton IA.
            </Text>
            <TextArea
              value={pasted}
              onChangeText={(t) => {
                setPasted(t);
                if (error) setError(null);
              }}
              placeholder='[ { "prompt": "…", "type": "single", "options": [ … ] } ]'
              placeholderTextColor="$placeholderColor"
              color="$color"
              backgroundColor="$surface"
              borderWidth={0}
              borderRadius="$md"
              flex={1}
              minHeight={140}
              paddingHorizontal={14}
              paddingTop={12}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Coller le JSON du quiz"
            />
            {error ? (
              <Text fontSize={12} color="#FF6B6B">
                {error}
              </Text>
            ) : null}
          </YStack>

          {/* CTA */}
          <Pressable
            onPress={handleImport}
            accessibilityRole="button"
            accessibilityLabel="Importer les questions"
            style={styles.importBtn}
          >
            <Text fontSize={15} fontWeight="800" color="#000000">
              Importer les questions
            </Text>
          </Pressable>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  copyBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 9999,
    alignItems: 'center',
  },
  importBtn: {
    backgroundColor: '#10D970',
    paddingVertical: 14,
    borderRadius: 9999,
    alignItems: 'center',
  },
});
