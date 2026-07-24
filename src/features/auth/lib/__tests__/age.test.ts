// Tests E13-01 — utilitaire d'âge (seuil 15 ans)
//
// On injecte `today` pour des tests déterministes (pas de dépendance à la date
// réelle d'exécution). Les cas limites d'anniversaire sont la source classique
// de bugs off-by-one sur ce genre de calcul.

import { getAge, isAtLeastMinAge, MIN_AGE_YEARS, parseBirthday } from '@/features/auth/lib/age';

const TODAY = new Date(2026, 6, 19); // 19 juillet 2026

describe('parseBirthday', () => {
  it('parse une date valide JJ/MM/AAAA', () => {
    expect(parseBirthday('01/02/2000')).toEqual(new Date(2000, 1, 1));
  });

  it('rejette un format invalide', () => {
    expect(parseBirthday('2000-02-01')).toBeNull();
    expect(parseBirthday('1/2/2000')).toBeNull();
    expect(parseBirthday('')).toBeNull();
  });

  it('rejette une date inexistante (pas de report silencieux)', () => {
    // 31/02 serait "roulé" en 03/03 par le constructeur Date → doit être rejeté.
    expect(parseBirthday('31/02/2000')).toBeNull();
    expect(parseBirthday('32/01/2000')).toBeNull();
  });
});

describe('getAge', () => {
  it('calcule l’âge révolu', () => {
    expect(getAge('19/07/2000', TODAY)).toBe(26); // anniversaire aujourd'hui
    expect(getAge('20/07/2000', TODAY)).toBe(25); // anniversaire demain
    expect(getAge('18/07/2000', TODAY)).toBe(26); // anniversaire hier
  });

  it('gère le cas « anniversaire plus tard dans l’année »', () => {
    expect(getAge('31/12/2010', TODAY)).toBe(15); // décembre pas encore passé
  });

  it('retourne null si la date est invalide', () => {
    expect(getAge('31/02/2000', TODAY)).toBeNull();
  });
});

describe('isAtLeastMinAge', () => {
  it('accepte pile 15 ans (jour d’anniversaire)', () => {
    expect(isAtLeastMinAge('19/07/2011', TODAY)).toBe(true);
  });

  it('refuse la veille des 15 ans', () => {
    expect(isAtLeastMinAge('20/07/2011', TODAY)).toBe(false);
  });

  it('refuse un enfant', () => {
    expect(isAtLeastMinAge('01/01/2018', TODAY)).toBe(false);
  });

  it('accepte un adulte', () => {
    expect(isAtLeastMinAge('01/01/1990', TODAY)).toBe(true);
  });

  it('refuse une date invalide', () => {
    expect(isAtLeastMinAge('31/02/2000', TODAY)).toBe(false);
  });

  it('le seuil exposé est bien 15', () => {
    expect(MIN_AGE_YEARS).toBe(15);
  });
});
