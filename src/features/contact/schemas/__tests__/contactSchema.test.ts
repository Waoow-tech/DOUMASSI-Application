// Tests E8-03 — schéma du formulaire de contact.

import { contactFr } from '@/i18n/fr/contact';

import { createContactSchema } from '../contactSchema';

const schema = createContactSchema(contactFr.validation);

const valid = {
  name: 'Awa Diallo',
  email: 'awa@example.com',
  subject: 'Bug sur le feed',
  message: 'Le feed ne charge pas depuis ce matin.',
};

describe('contactSchema', () => {
  it('accepte un formulaire complet valide', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('accepte téléphone et entreprise vides (optionnels)', () => {
    const res = schema.safeParse({ ...valid, phone: '', company: '' });
    expect(res.success).toBe(true);
  });

  it('refuse un nom vide', () => {
    const res = schema.safeParse({ ...valid, name: '   ' });
    expect(res.success).toBe(false);
  });

  it('refuse un e-mail invalide', () => {
    const res = schema.safeParse({ ...valid, email: 'pasunemail' });
    expect(res.success).toBe(false);
  });

  it('refuse un message trop court', () => {
    const res = schema.safeParse({ ...valid, message: 'court' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe(contactFr.validation.messageTooShort);
    }
  });

  it('refuse un sujet vide', () => {
    const res = schema.safeParse({ ...valid, subject: '' });
    expect(res.success).toBe(false);
  });
});
