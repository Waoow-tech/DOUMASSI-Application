// Tests E5-18 — calculatrice (mathjs)

import { calculate } from '@/features/ai/lib/calculator';

describe('calculate', () => {
  it('évalue les opérations de base', () => {
    expect(calculate('2 + 2')).toEqual({ ok: true, result: '4' });
    expect(calculate('10 / 4')).toEqual({ ok: true, result: '2.5' });
    expect(calculate('sqrt(16)')).toEqual({ ok: true, result: '4' });
    expect(calculate('2^10')).toEqual({ ok: true, result: '1024' });
    expect(calculate('(3 + 5) * 2')).toEqual({ ok: true, result: '16' });
  });

  it('corrige les artefacts flottants', () => {
    expect(calculate('0.1 + 0.2')).toEqual({ ok: true, result: '0.3' });
  });

  it('rejette une expression vide', () => {
    expect(calculate('   ')).toEqual({ ok: false, error: 'empty' });
  });

  it('rejette une expression invalide', () => {
    expect(calculate('2 +')).toEqual({ ok: false, error: 'invalid' });
    expect(calculate('bonjour')).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejette la division par zéro (Infinity)', () => {
    expect(calculate('1/0')).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejette une expression trop longue', () => {
    const huge = '1+'.repeat(200) + '1';
    expect(calculate(huge)).toEqual({ ok: false, error: 'invalid' });
  });
});
