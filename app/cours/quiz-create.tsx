// Écran Éditeur de quiz — E9-11 (#271) + import E9-12 (#272)
//
// Crée un quiz question par question (choix unique / multiple / vrai-faux),
// rattaché à une ressource (resourceId/level/subject passés en params). Deux
// façons de remplir : manuellement, ou via "Importer depuis ton IA" (E9-12)
// qui peuple la même liste. Convergence vers le même écran de relecture avant
// publication (règle d'or brief §7).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Plus, Sparkles, Trash2, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Text, View, XStack, YStack } from 'tamagui';

import { QuizImportSheet } from '@/features/cours/components/QuizImportSheet';
import { useCreateQuiz, type QuizQuestionType } from '@/features/cours/hooks/useCreateQuiz';
import type { ParsedQuizQuestion } from '@/features/cours/lib/quizImport';
import { SegmentedChoice } from '@/features/marketplace/components/SegmentedChoice';
import { useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';

const MAX_TITLE = 120;
const MAX_QUESTIONS = 30;

interface EditorOption {
  label: string;
  isCorrect: boolean;
}
interface EditorQuestion {
  key: string;
  prompt: string;
  type: QuizQuestionType;
  options: EditorOption[];
}

function makeBooleanOptions(trueLabel: string, falseLabel: string): EditorOption[] {
  return [
    { label: trueLabel, isCorrect: true },
    { label: falseLabel, isCorrect: false },
  ];
}

export default function QuizCreateScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    resourceId?: string;
    levelCode?: string;
    subjectCode?: string;
    resourceTitle?: string;
  }>();
  const resourceId = typeof params.resourceId === 'string' ? params.resourceId : null;
  const levelCode = typeof params.levelCode === 'string' ? params.levelCode : '';
  const subjectCode = typeof params.subjectCode === 'string' ? params.subjectCode : '';

  const createQuiz = useCreateQuiz();
  const keyCounter = useRef(0);
  const nextKey = () => `q${keyCounter.current++}`;

  const [title, setTitle] = useState(() =>
    params.resourceTitle ? t.cours.quizCreate.titlePrefix(String(params.resourceTitle)) : ''
  );
  const [questions, setQuestions] = useState<EditorQuestion[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const typeOptions = useMemo(
    () => [
      { value: 'single' as const, label: t.cours.quizCreate.types.single },
      { value: 'multiple' as const, label: t.cours.quizCreate.types.multiple },
      { value: 'boolean' as const, label: t.cours.quizCreate.types.boolean },
    ],
    [t]
  );

  // ---- Mutations de la liste de questions ----

  const addQuestion = useCallback(() => {
    setQuestions((prev) => {
      if (prev.length >= MAX_QUESTIONS) return prev;
      return [
        ...prev,
        {
          key: nextKey(),
          prompt: '',
          type: 'single',
          options: [
            { label: '', isCorrect: true },
            { label: '', isCorrect: false },
          ],
        },
      ];
    });
  }, []);

  const removeQuestion = useCallback((qi: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== qi));
  }, []);

  const setPrompt = useCallback((qi: number, text: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, prompt: text } : q)));
  }, []);

  const setType = useCallback(
    (qi: number, type: QuizQuestionType) => {
      setQuestions((prev) =>
        prev.map((q, i) => {
          if (i !== qi) return q;
          if (type === 'boolean')
            return {
              ...q,
              type,
              options: makeBooleanOptions(
                t.cours.quizCreate.boolean.true,
                t.cours.quizCreate.boolean.false
              ),
            };
          // single/multiple : garde les options mais si on repasse de boolean,
          // repart sur 2 options vides.
          const options =
            q.type === 'boolean'
              ? [
                  { label: '', isCorrect: true },
                  { label: '', isCorrect: false },
                ]
              : q.options;
          return { ...q, type, options };
        })
      );
    },
    [t]
  );

  const addOption = useCallback((qi: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi && q.options.length < 6
          ? { ...q, options: [...q.options, { label: '', isCorrect: false }] }
          : q
      )
    );
  }, []);

  const removeOption = useCallback((qi: number, oi: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi && q.options.length > 2
          ? { ...q, options: q.options.filter((_, j) => j !== oi) }
          : q
      )
    );
  }, []);

  const setOptionLabel = useCallback((qi: number, oi: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, label: text } : o)) }
          : q
      )
    );
  }, []);

  const toggleCorrect = useCallback((qi: number, oi: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qi) return q;
        // multiple → toggle ; single/boolean → radio (une seule bonne réponse)
        if (q.type === 'multiple') {
          return {
            ...q,
            options: q.options.map((o, j) => (j === oi ? { ...o, isCorrect: !o.isCorrect } : o)),
          };
        }
        return {
          ...q,
          options: q.options.map((o, j) => ({ ...o, isCorrect: j === oi })),
        };
      })
    );
  }, []);

  // ---- Import E9-12 ----

  const handleImported = useCallback((imported: ParsedQuizQuestion[]) => {
    setQuestions(
      imported.map((q) => ({
        key: nextKey(),
        prompt: q.prompt,
        type: q.type,
        options: q.options.map((o) => ({ label: o.label, isCorrect: o.is_correct })),
      }))
    );
  }, []);

  // ---- Submit ----

  const handleClose = useCallback(() => {
    if (questions.length === 0 && title.trim().length === 0) {
      router.back();
      return;
    }
    Alert.alert(t.cours.quizCreate.discardTitle, t.cours.quizCreate.discardMessage, [
      { text: t.cours.quizCreate.discardKeep, style: 'cancel' },
      {
        text: t.cours.quizCreate.discardConfirm,
        style: 'destructive',
        onPress: () => router.back(),
      },
    ]);
  }, [questions.length, title, t]);

  const validate = useCallback((): string | null => {
    const v = t.cours.quizCreate.validation;
    if (title.trim().length < 3) return v.titleMin;
    if (questions.length === 0) return v.noQuestions;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      const label = t.cours.quizCreate.questionLabel(i + 1);
      if (q.prompt.trim().length === 0) return v.promptMissing(label);
      if (q.options.length < 2) return v.minOptions(label);
      if (q.options.some((o) => o.label.trim().length === 0)) return v.optionLabelMissing(label);
      if (!q.options.some((o) => o.isCorrect)) return v.correctMissing(label);
    }
    return null;
  }, [questions, title, t]);

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) {
      Alert.alert(t.cours.quizCreate.incompleteTitle, err);
      return;
    }
    if (!levelCode || !subjectCode) {
      Alert.alert(t.cours.common.error, t.cours.quizCreate.missingTaxonomy);
      return;
    }
    try {
      await createQuiz.mutateAsync({
        title: title.trim(),
        levelCode,
        subjectCode,
        resourceId,
        questions: questions.map((q) => ({
          prompt: q.prompt.trim(),
          type: q.type,
          options: q.options.map((o) => ({ label: o.label.trim(), is_correct: o.isCorrect })),
        })),
      });
      // Retour à la fiche — le quiz apparaîtra (invalidation ['cours','quiz']).
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : t.cours.common.retry;
      logger.warn('create_quiz submit failed', { message });
      Alert.alert(t.cours.quizCreate.submitErrorTitle, message);
    }
  }, [validate, levelCode, subjectCode, resourceId, title, questions, createQuiz, t]);

  const isBusy = createQuiz.isPending;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View flex={1} backgroundColor="$background" paddingTop={insets.top}>
          {/* Header */}
          <XStack
            height={56}
            paddingHorizontal={12}
            alignItems="center"
            gap={12}
            borderBottomWidth={StyleSheet.hairlineWidth}
            borderBottomColor="$borderColor"
          >
            <Pressable
              onPress={handleClose}
              disabled={isBusy}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t.cours.common.cancel}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </Pressable>
            <Text flex={1} color="$color" fontSize={18} fontWeight="700">
              {t.cours.quizCreate.title}
            </Text>
          </XStack>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Titre */}
            <YStack gap={8} marginTop={12}>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder={t.cours.quizCreate.titlePlaceholder}
                placeholderTextColor="$placeholderColor"
                maxLength={MAX_TITLE}
                editable={!isBusy}
                color="$color"
                backgroundColor="$surface"
                borderWidth={0}
                borderRadius="$md"
                height={48}
                paddingHorizontal={14}
                accessibilityLabel={t.cours.quizCreate.titleA11y}
              />
            </YStack>

            {/* Import IA */}
            <Pressable
              onPress={() => setIsImportOpen(true)}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel={t.cours.quizCreate.importA11y}
              style={styles.importRow}
            >
              <XStack alignItems="center" justifyContent="center" gap={8}>
                <Sparkles size={16} color="#10D970" />
                <Text fontSize={13} fontWeight="700" color="$color">
                  {t.cours.quizCreate.importCta}
                </Text>
              </XStack>
            </Pressable>

            {/* Questions */}
            {questions.map((q, qi) => (
              <YStack
                key={q.key}
                marginTop={16}
                backgroundColor="$surface"
                borderRadius={14}
                padding={14}
                gap={12}
              >
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontSize={13} fontWeight="800" color="$accentNeon">
                    {t.cours.quizCreate.questionLabel(qi + 1)}
                  </Text>
                  <Pressable
                    onPress={() => removeQuestion(qi)}
                    disabled={isBusy}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t.cours.quizCreate.deleteQuestionA11y(qi + 1)}
                  >
                    <Trash2 size={16} color="#FF6B6B" />
                  </Pressable>
                </XStack>

                <Input
                  value={q.prompt}
                  onChangeText={(text) => setPrompt(qi, text)}
                  placeholder={t.cours.quizCreate.promptPlaceholder}
                  placeholderTextColor="$placeholderColor"
                  editable={!isBusy}
                  color="$color"
                  backgroundColor="$surfaceElevated"
                  borderWidth={0}
                  borderRadius="$md"
                  height={44}
                  paddingHorizontal={12}
                  accessibilityLabel={t.cours.quizCreate.promptA11y(qi + 1)}
                />

                <SegmentedChoice
                  options={typeOptions}
                  value={q.type}
                  onChange={(val) => setType(qi, val)}
                  disabled={isBusy}
                />

                {/* Options */}
                <YStack gap={8}>
                  {q.options.map((o, oi) => (
                    <XStack key={oi} alignItems="center" gap={8}>
                      {/* Toggle correct */}
                      <Pressable
                        onPress={() => toggleCorrect(qi, oi)}
                        disabled={isBusy}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole={q.type === 'multiple' ? 'checkbox' : 'radio'}
                        accessibilityLabel={t.cours.quizCreate.correctAnswerA11y(
                          o.label || t.cours.quizCreate.optionFallback(oi + 1)
                        )}
                        accessibilityState={{ checked: o.isCorrect, selected: o.isCorrect }}
                        style={[
                          styles.correctToggle,
                          o.isCorrect ? styles.correctToggleOn : null,
                          q.type === 'multiple' ? styles.square : styles.round,
                        ]}
                      >
                        {o.isCorrect ? <Check size={13} color="#000000" strokeWidth={3} /> : null}
                      </Pressable>

                      <Input
                        flex={1}
                        value={o.label}
                        onChangeText={(text) => setOptionLabel(qi, oi, text)}
                        placeholder={t.cours.quizCreate.optionPlaceholder(oi + 1)}
                        placeholderTextColor="$placeholderColor"
                        editable={!isBusy && q.type !== 'boolean'}
                        color="$color"
                        backgroundColor="$surfaceElevated"
                        borderWidth={0}
                        borderRadius="$md"
                        height={40}
                        paddingHorizontal={12}
                        fontSize={14}
                        accessibilityLabel={t.cours.quizCreate.optionLabelA11y(oi + 1)}
                      />

                      {/* Retirer une option (pas en boolean, min 2) */}
                      {q.type !== 'boolean' && q.options.length > 2 ? (
                        <Pressable
                          onPress={() => removeOption(qi, oi)}
                          disabled={isBusy}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={t.cours.quizCreate.removeOptionA11y(oi + 1)}
                        >
                          <X size={15} color="#A0A0A0" />
                        </Pressable>
                      ) : null}
                    </XStack>
                  ))}

                  {q.type !== 'boolean' && q.options.length < 6 ? (
                    <Pressable
                      onPress={() => addOption(qi)}
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityLabel={t.cours.quizCreate.addOptionA11y}
                      style={styles.addOption}
                    >
                      <Text fontSize={13} color="$textSecondary" fontWeight="600">
                        {t.cours.quizCreate.addOption}
                      </Text>
                    </Pressable>
                  ) : null}
                </YStack>
              </YStack>
            ))}

            {/* Ajouter une question */}
            {questions.length < MAX_QUESTIONS ? (
              <Pressable
                onPress={addQuestion}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel={t.cours.quizCreate.addQuestion}
                style={styles.addQuestion}
              >
                <XStack alignItems="center" justifyContent="center" gap={8}>
                  <Plus size={18} color="#FFFFFF" strokeWidth={2} />
                  <Text fontSize={14} fontWeight="700" color="#FFFFFF">
                    {t.cours.quizCreate.addQuestion}
                  </Text>
                </XStack>
              </Pressable>
            ) : null}
          </ScrollView>

          {/* CTA Publier */}
          <YStack
            paddingHorizontal={16}
            paddingTop={12}
            paddingBottom={insets.bottom + 12}
            backgroundColor="$background"
            borderTopWidth={StyleSheet.hairlineWidth}
            borderTopColor="$borderColor"
          >
            <Pressable
              onPress={() => void handleSubmit()}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel={t.cours.quizCreate.submitA11y}
              accessibilityState={{ disabled: isBusy }}
              style={[styles.cta, { backgroundColor: isBusy ? '#1A1A1A' : '#10D970' }]}
            >
              {isBusy ? (
                <ActivityIndicator color="#10D970" />
              ) : (
                <Text fontSize={15} fontWeight="800" color="#000000">
                  {t.cours.quizCreate.submitCta}
                </Text>
              )}
            </Pressable>
          </YStack>
        </View>
      </KeyboardAvoidingView>

      <QuizImportSheet
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={handleImported}
      />
    </>
  );
}

const styles = StyleSheet.create({
  addOption: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  addQuestion: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
  },
  correctToggle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#555',
  },
  correctToggleOn: {
    backgroundColor: '#10D970',
    borderColor: '#10D970',
  },
  cta: {
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  importRow: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2A3F33',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: '#12291D',
  },
  round: {
    borderRadius: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  square: {
    borderRadius: 6,
  },
});
