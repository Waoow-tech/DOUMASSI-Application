// Tests du libellé de conversation du drawer — E5-04.

import { conversationLabel } from '../conversationLabel';

const FALLBACK = 'Conversation';

describe('conversationLabel — priorité', () => {
  it('préfère le titre quand il existe', () => {
    expect(conversationLabel({ title: 'Révisions maths', preview: 'salut' }, FALLBACK)).toBe(
      'Révisions maths'
    );
  });

  it('retombe sur l’aperçu quand le titre est null', () => {
    expect(conversationLabel({ title: null, preview: 'Explique les fractions' }, FALLBACK)).toBe(
      'Explique les fractions'
    );
  });

  it('retombe sur l’aperçu quand le titre est vide/espaces', () => {
    expect(conversationLabel({ title: '   ', preview: 'Bonjour' }, FALLBACK)).toBe('Bonjour');
  });

  it('utilise le fallback quand titre ET aperçu sont absents', () => {
    expect(conversationLabel({ title: null, preview: null }, FALLBACK)).toBe(FALLBACK);
  });
});

describe('conversationLabel — troncature de l’aperçu', () => {
  it('ne tronque pas un aperçu court', () => {
    const short = 'Une question courte';
    expect(conversationLabel({ title: null, preview: short }, FALLBACK)).toBe(short);
  });

  it('tronque un aperçu long et ajoute une ellipse', () => {
    const long =
      'Peux-tu m’expliquer en détail comment fonctionne la photosynthèse chez les plantes vertes';
    const result = conversationLabel({ title: null, preview: long }, FALLBACK);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThan(long.length);

    // La partie avant l'ellipse est un vrai préfixe de l'original…
    const body = result.slice(0, -1);
    expect(long.startsWith(body)).toBe(true);
    // …et la coupe tombe sur une frontière de mot (le caractère suivant dans
    // l'original est une espace) : aucun mot n'est tranché en plein milieu.
    expect(long.charAt(body.length)).toBe(' ');
  });

  it('coupe proprement même sans espace exploitable', () => {
    const noSpaces = 'a'.repeat(80);
    const result = conversationLabel({ title: null, preview: noSpaces }, FALLBACK);
    expect(result.endsWith('…')).toBe(true);
  });
});
