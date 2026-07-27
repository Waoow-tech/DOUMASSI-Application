// Tests du parseur SSE — E5-03.
//
// On cible le scénario qui casse en silence : les fragments réseau ne
// respectent AUCUNE frontière de ligne. Une ligne `data:` peut arriver en
// deux, trois morceaux, ou plusieurs lignes peuvent tenir dans un fragment.
// Un parseur naïf (split par chunk) perd ou corrompt du texte, de façon
// intermittente et très difficile à reproduire à la main.

import { SseParser, type SseEvent } from '../sseParser';

/** Rejoue une séquence de fragments et concatène les événements produits. */
function run(chunks: string[]): SseEvent[] {
  const parser = new SseParser();
  const events: SseEvent[] = [];
  for (const chunk of chunks) events.push(...parser.push(chunk));
  events.push(...parser.flush());
  return events;
}

function deltas(events: SseEvent[]): string {
  return events
    .filter((e): e is Extract<SseEvent, { type: 'delta' }> => e.type === 'delta')
    .map((e) => e.text)
    .join('');
}

describe('SseParser — cas nominal', () => {
  it('décode des lignes data complètes', () => {
    const events = run([
      'data: {"delta":"Bonjour"}\n',
      'data: {"delta":" toi"}\n',
      'data: {"done":true}\n',
    ]);
    expect(deltas(events)).toBe('Bonjour toi');
    expect(events.at(-1)).toEqual({ type: 'done' });
  });
});

describe('SseParser — fragmentation (le vrai risque)', () => {
  it('reconstruit une ligne coupée en deux fragments', () => {
    // La ligne `data: {"delta":"Salut"}` arrive en deux morceaux.
    const events = run(['data: {"delta":"Sa', 'lut"}\n']);
    expect(deltas(events)).toBe('Salut');
  });

  it('reconstruit une ligne coupée en plein milieu du JSON, sur 3 fragments', () => {
    const events = run(['data: {"del', 'ta":"abc', '"}\n']);
    expect(deltas(events)).toBe('abc');
  });

  it('gère plusieurs lignes arrivées dans un seul fragment', () => {
    const events = run(['data: {"delta":"a"}\ndata: {"delta":"b"}\ndata: {"delta":"c"}\n']);
    expect(deltas(events)).toBe('abc');
  });

  it('gère une ligne dont le saut de ligne arrive au fragment suivant', () => {
    const events = run(['data: {"delta":"x"}', '\ndata: {"delta":"y"}\n']);
    expect(deltas(events)).toBe('xy');
  });

  it('traite un dernier événement sans saut de ligne final via flush()', () => {
    // Certains fournisseurs n'émettent pas de \n après le dernier data.
    const events = run(['data: {"delta":"fin"}']);
    expect(deltas(events)).toBe('fin');
  });
});

describe('SseParser — bruit et robustesse', () => {
  it('ignore les lignes de keep-alive et les commentaires', () => {
    const events = run([': keep-alive\n', '\n', 'data: {"delta":"ok"}\n']);
    expect(deltas(events)).toBe('ok');
    expect(events).toHaveLength(1);
  });

  it('ignore le sentinelle [DONE]', () => {
    const events = run(['data: {"delta":"z"}\n', 'data: [DONE]\n']);
    expect(deltas(events)).toBe('z');
    // [DONE] ne doit PAS produire d'événement done (ce n'est pas notre protocole)
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  it('ignore un fragment JSON invalide sans casser le flux', () => {
    const events = run(['data: {oops\n', 'data: {"delta":"après"}\n']);
    expect(deltas(events)).toBe('après');
  });

  it('ignore un delta vide', () => {
    const events = run(['data: {"delta":""}\n', 'data: {"delta":"réel"}\n']);
    expect(deltas(events)).toBe('réel');
  });
});

describe('SseParser — erreurs', () => {
  it('émet un événement error', () => {
    const events = run(['data: {"error":"quota_exceeded"}\n']);
    expect(events).toEqual([{ type: 'error', message: 'quota_exceeded' }]);
  });
});

describe('SseParser — Unicode fragmenté', () => {
  it('reconstitue un caractère accentué coupé entre deux fragments texte', () => {
    // Le decoder amont gère les octets ; ici on vérifie que couper la CHAÎNE
    // en plein milieu ne perd pas de caractère une fois recollée.
    const events = run(['data: {"delta":"caf', 'é ☕"}\n']);
    expect(deltas(events)).toBe('café ☕');
  });
});
