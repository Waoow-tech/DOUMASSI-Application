// Tests de mergeMessages — E5-03.
//
// Fusionne les messages persistés (source de vérité) et le tour optimiste en
// cours. La règle à ne pas casser : pendant qu'un tour est en cours, on affiche
// le message utilisateur ET la réponse en train de s'écrire, SANS jamais
// dupliquer ce qui est déjà en base.

import { mergeMessages } from '../../lib/mergeMessages';
import type { AiMessage } from '../useAiConversation';

const persisted: AiMessage[] = [
  { id: 'm1', role: 'user', content: 'Salut', created_at: '2026-07-24T10:00:00Z' },
  { id: 'm2', role: 'assistant', content: 'Bonjour !', created_at: '2026-07-24T10:00:01Z' },
];

describe('mergeMessages — sans tour en cours', () => {
  it('rend les messages persistés tels quels', () => {
    const result = mergeMessages(persisted, null);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.key)).toEqual(['m1', 'm2']);
    expect(result.every((m) => !m.streaming)).toBe(true);
  });

  it('filtre les messages système', () => {
    const withSystem: AiMessage[] = [
      { id: 's', role: 'system', content: 'prompt', created_at: '2026-07-24T09:59:00Z' },
      ...persisted,
    ];
    const result = mergeMessages(withSystem, null);
    expect(result.map((m) => m.role)).toEqual(['user', 'assistant']);
  });
});

describe('mergeMessages — tour en cours', () => {
  it('avant le premier fragment : ajoute le message user, PAS de bulle assistant', () => {
    const result = mergeMessages(persisted, {
      userContent: 'Ça va ?',
      assistantContent: '',
      isWaitingFirstChunk: true,
    });
    expect(result).toHaveLength(3);
    expect(result[2]).toMatchObject({ key: 'pending-user', role: 'user', content: 'Ça va ?' });
    // La bulle « frappe… » est gérée séparément par l'écran, pas ici.
    expect(result.some((m) => m.key === 'pending-assistant')).toBe(false);
  });

  it('pendant le stream : ajoute user + bulle assistant marquée streaming', () => {
    const result = mergeMessages(persisted, {
      userContent: 'Ça va ?',
      assistantContent: 'Oui, et', // fragment partiel
      isWaitingFirstChunk: false,
    });
    expect(result).toHaveLength(4);
    expect(result[2]).toMatchObject({ key: 'pending-user', content: 'Ça va ?' });
    expect(result[3]).toMatchObject({
      key: 'pending-assistant',
      role: 'assistant',
      content: 'Oui, et',
      streaming: true,
    });
  });

  it('ne duplique jamais les messages déjà persistés', () => {
    const result = mergeMessages(persisted, {
      userContent: 'nouveau',
      assistantContent: 'x',
      isWaitingFirstChunk: false,
    });
    const persistedKeys = result.filter((m) => !m.key.startsWith('pending')).map((m) => m.key);
    expect(persistedKeys).toEqual(['m1', 'm2']);
  });
});
