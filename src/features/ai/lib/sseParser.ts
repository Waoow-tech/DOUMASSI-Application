// Parseur d'événements SSE de l'Edge Function `ai-chat` — E5-03.
//
// Isolé du transport (fetch/stream) pour être TESTABLE sans device : c'est ici
// que se logent les bugs de fragmentation, quand une ligne `data:` est coupée
// en deux entre deux lectures réseau. Le parseur est un objet à état qui reçoit
// des fragments de texte arbitraires et rend les événements complets.

export type SseEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export class SseParser {
  private buffer = '';

  /**
   * Ingère un fragment de texte et renvoie les événements complets qu'il
   * permet de décoder. Le reliquat (ligne partielle) est conservé pour le
   * prochain appel.
   */
  push(chunk: string): SseEvent[] {
    this.buffer += chunk;

    const events: SseEvent[] = [];
    const lines = this.buffer.split('\n');
    // La dernière entrée peut être une ligne incomplète : on la garde.
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const event = this.parseLine(line);
      if (event) events.push(event);
    }
    return events;
  }

  /**
   * À appeler quand le flux se termine : traite un éventuel reliquat sans
   * saut de ligne final (le fournisseur peut ne pas en émettre après [DONE]).
   */
  flush(): SseEvent[] {
    if (!this.buffer.trim()) {
      this.buffer = '';
      return [];
    }
    const event = this.parseLine(this.buffer);
    this.buffer = '';
    return event ? [event] : [];
  }

  private parseLine(line: string): SseEvent | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return null;

    const raw = trimmed.slice(5).trim();
    if (!raw) return null;

    // Le sentinelle OpenAI/Mistral. Notre Edge Function n'en émet pas, mais un
    // fournisseur peut le laisser passer : on l'ignore plutôt que de le parser.
    if (raw === '[DONE]') return null;

    let parsed: { delta?: string; done?: boolean; error?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fragment non-JSON (commentaire de keep-alive, ligne vide) → ignoré.
      return null;
    }

    if (parsed.error) return { type: 'error', message: parsed.error };
    if (parsed.done) return { type: 'done' };
    if (typeof parsed.delta === 'string' && parsed.delta.length > 0) {
      return { type: 'delta', text: parsed.delta };
    }
    return null;
  }
}
