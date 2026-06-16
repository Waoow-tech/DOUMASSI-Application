// Tests reply (E6-06) — MessageInput
//
// Couverture :
//   • Pas d'encart de réponse quand replyTo est null/absent
//   • Encart affiché avec contenu + libellé auteur quand replyTo est fourni
//   • Parent soft-deleted → "Message supprimé" dans l'encart
//   • Croix → onCancelReply appelé
//   • Envoi → onSend appelé avec (content, replyTo.id)
//   • Envoi sans replyTo → onSend appelé avec (content, null)

import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { MessageInput } from '@/features/messaging/components/MessageInput';
import type { MessageRow } from '@/features/messaging/hooks/useConversationMessages';
import { renderWithTamagui as render } from '@/test-utils/renderWithTamagui';

function makeMessage(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'parent-1',
    conversation_id: 'conv-1',
    sender_id: 'user-other',
    attachment_type: 'text',
    content: 'Message ciblé',
    attachment_url: null,
    reply_to_id: null,
    created_at: '2026-06-11T10:00:00Z',
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe('MessageInput — reply (E6-06)', () => {
  it("n'affiche pas d'encart de réponse quand replyTo est absent", () => {
    const { queryByText } = render(<MessageInput onSend={jest.fn()} />);
    expect(queryByText('Réponse')).toBeNull();
  });

  it('affiche un encart de réponse avec le contenu et le libellé auteur', () => {
    const replyTo = makeMessage({ content: 'Salut, ça va ?' });
    const { getByText } = render(
      <MessageInput onSend={jest.fn()} replyTo={replyTo} replyToAuthorLabel="Jean" />
    );
    expect(getByText('Réponse à Jean')).toBeTruthy();
    expect(getByText('Salut, ça va ?')).toBeTruthy();
  });

  it('affiche « Message supprimé » si le message ciblé est soft-deleted', () => {
    const replyTo = makeMessage({ deleted_at: '2026-06-11T11:00:00Z' });
    const { getByText } = render(
      <MessageInput onSend={jest.fn()} replyTo={replyTo} replyToAuthorLabel="Jean" />
    );
    expect(getByText('🚫 Message supprimé')).toBeTruthy();
  });

  it('appelle onCancelReply au tap sur la croix', () => {
    const onCancelReply = jest.fn();
    const replyTo = makeMessage();
    const { getByLabelText } = render(
      <MessageInput onSend={jest.fn()} replyTo={replyTo} onCancelReply={onCancelReply} />
    );
    fireEvent.press(getByLabelText('Annuler la réponse'));
    expect(onCancelReply).toHaveBeenCalledTimes(1);
  });

  it('envoie le message avec replyTo.id quand une réponse est en cours', () => {
    const onSend = jest.fn();
    const replyTo = makeMessage({ id: 'parent-xyz' });
    const { getByPlaceholderText, getByLabelText } = render(
      <MessageInput onSend={onSend} replyTo={replyTo} />
    );

    fireEvent.changeText(getByPlaceholderText('Écrire un message…'), 'Ma réponse');
    fireEvent.press(getByLabelText('Envoyer le message'));

    expect(onSend).toHaveBeenCalledWith('Ma réponse', 'parent-xyz');
  });

  it('envoie le message avec replyToId null en absence de réponse', () => {
    const onSend = jest.fn();
    const { getByPlaceholderText, getByLabelText } = render(<MessageInput onSend={onSend} />);

    fireEvent.changeText(getByPlaceholderText('Écrire un message…'), 'Message normal');
    fireEvent.press(getByLabelText('Envoyer le message'));

    expect(onSend).toHaveBeenCalledWith('Message normal', null);
  });
});
