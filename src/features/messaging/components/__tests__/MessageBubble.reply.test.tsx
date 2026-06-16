// Tests reply (E6-06) — MessageBubble
//
// Couverture :
//   • Long-press autorisé sur les bulles des autres (pas seulement les miennes)
//   • Pas de long-press sur message supprimé (mine ou not)
//   • Encart de réponse affiché quand reply_to_id est posé
//   • Contenu de l'encart : auteur + 50 premiers caractères du parent
//   • Parent soft-deleted → "Message supprimé" dans l'encart
//   • Parent introuvable (pas dans messagesById) → "Message non disponible"
//   • Tap sur l'encart → onReplyPress appelé avec le bon parentId
//   • Pas d'encart si reply_to_id est null

import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { MessageBubble } from '@/features/messaging/components/MessageBubble';
import type { MessageRow } from '@/features/messaging/hooks/useConversationMessages';
import { renderWithTamagui as render } from '@/test-utils/renderWithTamagui';

function makeMessage(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-other',
    attachment_type: 'text',
    content: 'Hello world',
    attachment_url: null,
    reply_to_id: null,
    created_at: '2026-06-11T10:00:00Z',
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe('MessageBubble — reply (E6-06)', () => {
  it("appelle onLongPress sur une bulle d'un autre user (pas seulement la mienne)", () => {
    const onLongPress = jest.fn();
    const message = makeMessage({ sender_id: 'user-other' });

    const { getByText } = render(
      <MessageBubble message={message} isMine={false} onLongPress={onLongPress} />
    );

    fireEvent(getByText('Hello world').parent?.parent ?? getByText('Hello world'), 'longPress');
    expect(onLongPress).toHaveBeenCalledWith(message);
  });

  it('ne déclenche pas onLongPress sur un message supprimé', () => {
    const onLongPress = jest.fn();
    const message = makeMessage({ deleted_at: '2026-06-11T11:00:00Z' });

    const { getByText } = render(
      <MessageBubble message={message} isMine={false} onLongPress={onLongPress} />
    );

    const node = getByText('🚫 Message supprimé');
    fireEvent(node.parent?.parent ?? node, 'longPress');
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("n'affiche pas d'encart de réponse quand reply_to_id est null", () => {
    const parent = makeMessage({ id: 'parent-1', content: 'Devrait rester invisible' });
    const message = makeMessage({ reply_to_id: null });
    const { queryByText } = render(
      <MessageBubble message={message} isMine={false} parentMessage={parent} />
    );
    // Même si un parentMessage est passé par erreur, sans reply_to_id l'encart
    // ne doit jamais apparaître.
    expect(queryByText('Devrait rester invisible')).toBeNull();
  });

  it("affiche l'encart de réponse avec auteur + contenu du parent", () => {
    const parent = makeMessage({
      id: 'parent-1',
      content: 'Le message original',
      sender_id: 'user-other',
    });
    const message = makeMessage({ id: 'msg-2', reply_to_id: 'parent-1' });

    const { getByText } = render(
      <MessageBubble
        message={message}
        isMine={false}
        parentMessage={parent}
        parentAuthorLabel="Jean"
      />
    );

    expect(getByText('Jean')).toBeTruthy();
    expect(getByText('Le message original')).toBeTruthy();
  });

  it('tronque le contenu du parent à 50 caractères', () => {
    const longContent = 'A'.repeat(120);
    const parent = makeMessage({ id: 'parent-1', content: longContent });
    const message = makeMessage({ id: 'msg-2', reply_to_id: 'parent-1' });

    const { getByText } = render(
      <MessageBubble
        message={message}
        isMine={false}
        parentMessage={parent}
        parentAuthorLabel="Jean"
      />
    );

    expect(getByText('A'.repeat(50))).toBeTruthy();
  });

  it('affiche « Message supprimé » quand le parent est soft-deleted', () => {
    const parent = makeMessage({
      id: 'parent-1',
      content: 'Original',
      deleted_at: '2026-06-11T11:00:00Z',
    });
    const message = makeMessage({ id: 'msg-2', reply_to_id: 'parent-1' });

    const { getByText } = render(
      <MessageBubble
        message={message}
        isMine={false}
        parentMessage={parent}
        parentAuthorLabel="Jean"
      />
    );

    expect(getByText('🚫 Message supprimé')).toBeTruthy();
  });

  it('affiche « Message non disponible » quand le parent est introuvable', () => {
    const message = makeMessage({ id: 'msg-2', reply_to_id: 'parent-missing' });

    const { getByText } = render(
      <MessageBubble message={message} isMine={false} parentMessage={null} />
    );

    expect(getByText('Message non disponible')).toBeTruthy();
  });

  it("appelle onReplyPress avec le reply_to_id au tap sur l'encart", () => {
    const onReplyPress = jest.fn();
    const parent = makeMessage({ id: 'parent-1', content: 'Original' });
    const message = makeMessage({ id: 'msg-2', reply_to_id: 'parent-1' });

    const { getByText } = render(
      <MessageBubble
        message={message}
        isMine={false}
        parentMessage={parent}
        parentAuthorLabel="Jean"
        onReplyPress={onReplyPress}
      />
    );

    fireEvent.press(getByText('Original'));
    expect(onReplyPress).toHaveBeenCalledWith('parent-1');
  });

  it("n'appelle pas onReplyPress si le parent est introuvable (pressable disabled)", () => {
    const onReplyPress = jest.fn();
    const message = makeMessage({ id: 'msg-2', reply_to_id: 'parent-missing' });

    const { getByText } = render(
      <MessageBubble
        message={message}
        isMine={false}
        parentMessage={null}
        onReplyPress={onReplyPress}
      />
    );

    fireEvent.press(getByText('Message non disponible'));
    expect(onReplyPress).not.toHaveBeenCalled();
  });
});
