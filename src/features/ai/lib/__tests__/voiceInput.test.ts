// Tests E5-12 — helpers purs de l'entrée vocale.

import { formatDuration } from '@/features/ai/lib/voiceInput';

describe('formatDuration', () => {
  it('formate en M:SS', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5_000)).toBe('0:05');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(600_000)).toBe('10:00');
  });

  it('tronque les millisecondes (pas d’arrondi au-dessus)', () => {
    expect(formatDuration(1_999)).toBe('0:01');
  });
});
