// Tests reply (E6-06) — MessageActionSheet
//
// Couverture :
//   • isMine=false → seule l'option "Répondre" est affichée (pas Modifier/Supprimer)
//   • isMine=true → Modifier/Supprimer affichés, pas "Répondre"
//   • Tap "Répondre" → onReply appelé puis sheet fermée (onOpenChange(false))

import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { MessageActionSheet } from '@/features/messaging/components/MessageActionSheet';
import type { MessageRow } from '@/features/messaging/hooks/useConversationMessages';
import { renderWithTamagui as render } from '@/test-utils/renderWithTamagui';

function makeMessage(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'user-other',
    attachment_type: 'text',
    content: 'Hello',
    attachment_url: null,
    reply_to_id: null,
    created_at: '2026-06-11T10:00:00Z',
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe('MessageActionSheet — reply (E6-06)', () => {
  it('isMine=false → affiche uniquement « Répondre », pas Modifier/Supprimer', () => {
    const message = makeMessage();
    const { getByText, queryByText } = render(
      <MessageActionSheet
        message={message}
        isMine={false}
        open
        onOpenChange={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onReply={jest.fn()}
      />
    );

    expect(getByText('Répondre')).toBeTruthy();
    expect(queryByText('Modifier')).toBeNull();
    expect(queryByText('Supprimer')).toBeNull();
  });

  it('isMine=true → affiche Modifier/Supprimer, pas « Répondre »', () => {
    const message = makeMessage();
    const { getByText, queryByText } = render(
      <MessageActionSheet
        message={message}
        isMine={true}
        open
        onOpenChange={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onReply={jest.fn()}
      />
    );

    expect(getByText('Modifier')).toBeTruthy();
    expect(getByText('Supprimer')).toBeTruthy();
    expect(queryByText('Répondre')).toBeNull();
  });

  it('tap "Répondre" → appelle onReply puis ferme la sheet', () => {
    const onReply = jest.fn();
    const onOpenChange = jest.fn();
    const message = makeMessage();

    const { getByText } = render(
      <MessageActionSheet
        message={message}
        isMine={false}
        open
        onOpenChange={onOpenChange}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onReply={onReply}
      />
    );

    fireEvent.press(getByText('Répondre'));

    expect(onReply).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('isMine=false sans onReply fourni → ne plante pas au tap', () => {
    const message = makeMessage();
    const { getByText } = render(
      <MessageActionSheet
        message={message}
        isMine={false}
        open
        onOpenChange={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(() => fireEvent.press(getByText('Répondre'))).not.toThrow();
  });

  it("isMine=false + attachment_type !== 'text' → « Répondre » non affiché (réponse texte uniquement)", () => {
    const message = makeMessage({ attachment_type: 'image', content: null });
    const { queryByText } = render(
      <MessageActionSheet
        message={message}
        isMine={false}
        open
        onOpenChange={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onReply={jest.fn()}
      />
    );

    expect(queryByText('Répondre')).toBeNull();
  });
});
