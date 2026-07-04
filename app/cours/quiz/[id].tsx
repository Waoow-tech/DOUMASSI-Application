// Écran Passer un quiz — E9-13 (#273)
//
// Deux phases dans le même écran :
//   1. Jeu : questions une sous l'autre, sélection radio (single/boolean) ou
//      checkbox (multiple). Bouton Valider actif quand tout est répondu.
//   2. Résultat : score % + meilleur score + corrigé par question (options
//      correctes en vert, mauvais choix de l'user en rouge). Recommencer.
//
// Scoring 100% serveur (submit_quiz_attempt) — le client ne connaît jamais
// les bonnes réponses avant d'avoir validé. Tentatives illimitées + meilleur
// score affiché (brief §15.5).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, RotateCcw, Trophy, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import {
  useMyBestQuizScore,
  useQuiz,
  useSubmitQuizAttempt,
  type QuizAttemptResult,
} from '@/features/cours/hooks/useQuizPlay';
import { logger } from '@/lib/logger';

export default function QuizPlayScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const quizId = typeof params.id === 'string' ? params.id : null;

  const { data: quiz, isLoading, isError } = useQuiz(quizId);
  const bestScoreQuery = useMyBestQuizScore(quizId);
  const submitAttempt = useSubmitQuizAttempt();

  // Réponses : questionId → set d'option ids sélectionnés.
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const allAnswered = useMemo(() => {
    if (!quiz) return false;
    return quiz.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
  }, [quiz, answers]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/cours');
  }, []);

  const selectOption = useCallback(
    (questionId: string, optionId: string, type: 'single' | 'multiple' | 'boolean') => {
      if (result) return; // verrouillé après validation
      setAnswers((prev) => {
        const current = prev[questionId] ?? [];
        if (type === 'multiple') {
          const next = current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId];
          return { ...prev, [questionId]: next };
        }
        // single / boolean → une seule sélection
        return { ...prev, [questionId]: [optionId] };
      });
    },
    [result]
  );

  const handleSubmit = useCallback(async () => {
    if (!quiz || !quizId || !allAnswered) return;
    try {
      const payload = quiz.questions.map((q) => ({
        question_id: q.id,
        selected_option_ids: answers[q.id] ?? [],
      }));
      const res = await submitAttempt.mutateAsync({ quizId, answers: payload });
      setResult(res);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Réessaie.';
      logger.warn('submit quiz failed', { message });
      Alert.alert('Erreur', message);
    }
  }, [quiz, quizId, allAnswered, answers, submitAttempt]);

  const handleRetry = useCallback(() => {
    setAnswers({});
    setResult(null);
  }, []);

  // Map questionId → correction pour l'affichage du corrigé.
  const correctionByQuestion = useMemo(() => {
    const m = new Map<string, { is_correct: boolean; correct_option_ids: string[] }>();
    result?.corrections.forEach((c) =>
      m.set(c.question_id, { is_correct: c.is_correct, correct_option_ids: c.correct_option_ids })
    );
    return m;
  }, [result]);

  const header = (
    <XStack
      height={56}
      paddingHorizontal={12}
      alignItems="center"
      gap={12}
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$borderColor"
    >
      <Pressable
        onPress={handleBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <ArrowLeft size={24} color="#FFFFFF" />
      </Pressable>
      <Text flex={1} color="$color" fontSize={17} fontWeight="700" numberOfLines={1}>
        {quiz?.title ?? 'Quiz'}
      </Text>
    </XStack>
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
          {header}
          <YStack flex={1} alignItems="center" justifyContent="center">
            <ActivityIndicator color="#FFFFFF" />
          </YStack>
        </YStack>
      </>
    );
  }

  if (isError || !quiz) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
          {header}
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            paddingHorizontal={24}
            gap={8}
          >
            <Text fontSize={16} fontWeight="700" color="$color">
              Quiz introuvable
            </Text>
          </YStack>
        </YStack>
      </>
    );
  }

  const best = bestScoreQuery.data ?? null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        {header}

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* Résultat (après validation) */}
          {result ? (
            <YStack
              backgroundColor="$surface"
              borderRadius={16}
              padding={20}
              alignItems="center"
              gap={6}
              marginBottom={16}
            >
              <Trophy size={32} color="#10D970" />
              <Text fontSize={32} fontWeight="900" color="$accentNeon">
                {result.score_pct}%
              </Text>
              <Text fontSize={14} color="$color" fontWeight="600">
                {result.correct_count}/{result.total_count} bonnes réponses
              </Text>
              {best != null ? (
                <Text fontSize={12} color="$textSecondary">
                  Meilleur score : {best}%
                </Text>
              ) : null}
            </YStack>
          ) : (
            <XStack alignItems="center" justifyContent="space-between" marginBottom={12}>
              <Text fontSize={13} color="$textSecondary">
                {quiz.question_count} question{quiz.question_count > 1 ? 's' : ''}
              </Text>
              {best != null ? (
                <XStack alignItems="center" gap={4}>
                  <Trophy size={13} color="#10D970" />
                  <Text fontSize={12} color="$textSecondary">
                    Meilleur : {best}%
                  </Text>
                </XStack>
              ) : null}
            </XStack>
          )}

          {/* Questions */}
          {quiz.questions.map((q, qi) => {
            const selected = answers[q.id] ?? [];
            const correction = correctionByQuestion.get(q.id);
            const isMulti = q.type === 'multiple';
            return (
              <YStack
                key={q.id}
                backgroundColor="$surface"
                borderRadius={14}
                padding={14}
                gap={10}
                marginBottom={12}
              >
                <XStack gap={8} alignItems="flex-start">
                  <Text fontSize={14} fontWeight="800" color="$accentNeon">
                    {qi + 1}.
                  </Text>
                  <Text flex={1} fontSize={15} fontWeight="600" color="$color">
                    {q.prompt}
                  </Text>
                  {correction ? (
                    correction.is_correct ? (
                      <Check size={18} color="#10D970" strokeWidth={2.5} />
                    ) : (
                      <X size={18} color="#FF6B6B" strokeWidth={2.5} />
                    )
                  ) : null}
                </XStack>

                {isMulti && !result ? (
                  <Text fontSize={11} color="$textSecondary">
                    Plusieurs réponses possibles
                  </Text>
                ) : null}

                <YStack gap={8}>
                  {q.options.map((opt) => {
                    const isSelected = selected.includes(opt.id);
                    // Couleurs en mode corrigé
                    let bg = '$surfaceElevated';
                    let borderColor = 'transparent';
                    if (correction) {
                      const isCorrectOpt = correction.correct_option_ids.includes(opt.id);
                      if (isCorrectOpt) {
                        bg = '#12291D';
                        borderColor = '#10D970';
                      } else if (isSelected) {
                        bg = '#2E1522';
                        borderColor = '#FF6B6B';
                      }
                    } else if (isSelected) {
                      bg = '#12291D';
                      borderColor = '#10D970';
                    }
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => selectOption(q.id, opt.id, q.type)}
                        disabled={Boolean(result)}
                        accessibilityRole={isMulti ? 'checkbox' : 'radio'}
                        accessibilityLabel={opt.label}
                        accessibilityState={{ checked: isSelected, selected: isSelected }}
                        style={[styles.option, { backgroundColor: bg, borderColor }]}
                      >
                        <XStack alignItems="center" gap={10}>
                          <View
                            style={[
                              styles.marker,
                              isMulti ? styles.square : styles.round,
                              isSelected ? styles.markerOn : null,
                            ]}
                          >
                            {isSelected ? (
                              <Check size={12} color="#000000" strokeWidth={3} />
                            ) : null}
                          </View>
                          <Text flex={1} fontSize={14} color="$color">
                            {opt.label}
                          </Text>
                        </XStack>
                      </Pressable>
                    );
                  })}
                </YStack>
              </YStack>
            );
          })}
        </ScrollView>

        {/* CTA bottom */}
        <YStack
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          paddingHorizontal={16}
          paddingTop={12}
          paddingBottom={insets.bottom + 12}
          backgroundColor="$background"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$borderColor"
        >
          {result ? (
            <Pressable
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Recommencer le quiz"
              style={[styles.cta, { backgroundColor: '#FFFFFF' }]}
            >
              <XStack alignItems="center" justifyContent="center" gap={8}>
                <RotateCcw size={16} color="#000000" strokeWidth={2.4} />
                <Text fontSize={15} fontWeight="800" color="#000000">
                  Recommencer
                </Text>
              </XStack>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleSubmit()}
              disabled={!allAnswered || submitAttempt.isPending}
              accessibilityRole="button"
              accessibilityLabel="Valider mes réponses"
              accessibilityState={{ disabled: !allAnswered || submitAttempt.isPending }}
              style={[
                styles.cta,
                {
                  backgroundColor: allAnswered && !submitAttempt.isPending ? '#10D970' : '#1A1A1A',
                },
              ]}
            >
              {submitAttempt.isPending ? (
                <ActivityIndicator color="#10D970" />
              ) : (
                <Text fontSize={15} fontWeight="800" color={allAnswered ? '#000000' : '#666'}>
                  {allAnswered ? 'Valider' : 'Réponds à toutes les questions'}
                </Text>
              )}
            </Pressable>
          )}
        </YStack>
      </YStack>
    </>
  );
}

const styles = StyleSheet.create({
  cta: {
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#555',
  },
  markerOn: {
    backgroundColor: '#10D970',
    borderColor: '#10D970',
  },
  option: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  round: {
    borderRadius: 11,
  },
  square: {
    borderRadius: 6,
  },
});
