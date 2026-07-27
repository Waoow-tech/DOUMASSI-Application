// ENGLISH dictionary — `ai` namespace (E5-03).
// Same keys as fr/ai.ts (typed as AiTranslations).

import type { AiTranslations } from '../fr/ai';

export const aiEn: AiTranslations = {
  header: {
    title: 'Doumassi AI',
    newChat: 'New chat',
    newChatA11y: 'Start a new chat',
  },

  empty: {
    title: 'Ask anything',
    subtitle: 'Doumassi AI can help you study, write, understand… Give it a try.',
  },

  suggestions: {
    explain: 'Explain a concept',
    summarize: 'Summarize a text',
    ideas: 'Give me ideas',
  },

  input: {
    placeholder: 'Type your message…',
    sendA11y: 'Send message',
    stopA11y: 'Stop generating',
  },

  bubble: {
    typing: 'Doumassi AI is typing…',
    assistantLabel: 'Doumassi AI',
  },

  errors: {
    quota: (quota: number) =>
      `You've reached your limit of ${quota} messages for today. Come back tomorrow.`,
    auth: 'Your session has expired. Please sign in again.',
    provider: 'The assistant is momentarily unavailable. Try again in a moment.',
    network: 'Connection failed. Check your connection and try again.',
    generic: 'Something went wrong. Please try again.',
    retry: 'Retry',
  },
};
