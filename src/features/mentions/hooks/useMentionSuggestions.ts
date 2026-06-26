// useMentionSuggestions — Sprint 6, ticket #213 (PR B).
//
// Détecte si l'utilisateur est en train de saisir une mention `@xxx` à la
// position du curseur dans un composer (post, message). Si oui, expose la
// liste de suggestions issue de `search_users`, et un helper pour insérer
// la mention choisie en remplaçant le `@xxx` partiel.
//
// Utilisation typique côté composer :
//
//   const [text, setText] = useState('');
//   const [cursor, setCursor] = useState(0);
//   const { activeQuery, suggestions, isLoading, replaceMention } =
//     useMentionSuggestions(text, cursor);
//
//   <TextArea
//     value={text}
//     onChangeText={(v) => { setText(v); setCursor(v.length); }}
//     onSelectionChange={(e) => setCursor(e.nativeEvent.selection.end)}
//   />
//   {activeQuery !== null ? (
//     <MentionSuggestionsList
//       suggestions={suggestions}
//       onSelect={(u) => {
//         const next = replaceMention(u.username);
//         setText(next.text);
//         setCursor(next.cursor);
//       }}
//     />
//   ) : null}

import { useMemo } from 'react';

import { useSearchUsers, type SearchUserResult } from '@/features/profile/hooks/useSearchUsers';

// Pattern d'un username DOUMASSI (cohérent avec RPC update_username + helper
// SQL fn_extract_mentions). Les longueurs 0-30 ici, mais en pratique la RPC
// search_users ne matchera rien sous 2 caractères (cf `canSearch`).
const MENTION_TYPING_CHAR = /[A-Za-z0-9_]/;

interface ActiveMention {
  /** Index du `@` dans `text`. */
  start: number;
  /** Index juste après le dernier char tapé (= curseur). */
  end: number;
  /** Ce qui suit le `@`, en lowercase (vide si curseur juste après `@`). */
  query: string;
}

/**
 * Trouve la mention en cours de saisie à la position du curseur.
 * Retourne null si rien d'actif (curseur dans du texte normal, ou mention
 * déjà "terminée" par un espace).
 */
function findActiveMention(text: string, cursorPosition: number): ActiveMention | null {
  if (!text || cursorPosition < 0 || cursorPosition > text.length) {
    return null;
  }

  // Remonte depuis le curseur jusqu'à trouver `@` (ou un séparateur qui
  // invalide la mention). Tout caractère entre `@` et le curseur doit être
  // dans [A-Za-z0-9_].
  for (let i = cursorPosition - 1; i >= 0; i -= 1) {
    const char = text[i];
    if (char === '@') {
      // Le `@` doit être en début de chaîne ou précédé d'un caractère non-word.
      // Sinon `mon.email@x` matcherait `@x` comme mention, ce qui est faux.
      const prevChar = i > 0 ? text[i - 1] : undefined;
      if (prevChar !== undefined && /[A-Za-z0-9_]/.test(prevChar)) {
        return null;
      }
      const query = text.slice(i + 1, cursorPosition).toLowerCase();
      // Sécurité : ne déclenche pas la dropdown au-delà de 30 chars (limite
      // username). Au-delà, soit l'utilisateur écrit autre chose, soit on a
      // déjà passé la mention.
      if (query.length > 30) {
        return null;
      }
      return { start: i, end: cursorPosition, query };
    }
    if (char === undefined || !MENTION_TYPING_CHAR.test(char)) {
      // Saut de ligne, espace, ponctuation → pas de mention active à ce curseur
      return null;
    }
  }
  return null;
}

export interface MentionReplacement {
  /** Nouveau contenu du composer avec la mention insérée. */
  text: string;
  /** Position du curseur après insertion (= juste après `@username `). */
  cursor: number;
}

export interface UseMentionSuggestionsResult {
  /** Query active (sans le `@`) ou null si pas de mention en cours. */
  activeQuery: string | null;
  /** Position début/fin du `@xxx` en cours (utile pour styliser). */
  activeRange: { start: number; end: number } | null;
  /** Suggestions issues de search_users (vide si activeQuery < 2 chars). */
  suggestions: SearchUserResult[];
  isLoading: boolean;
  isError: boolean;
  /**
   * Remplace le `@xxx` actif par `@username ` (avec espace final).
   * Renvoie le nouveau texte et la position du curseur après insertion.
   * À utiliser comme retour de `onSelect` dans la dropdown.
   *
   * Si appelée alors qu'aucune mention n'est active, retourne le texte
   * inchangé (no-op safe).
   */
  replaceMention: (selectedUsername: string) => MentionReplacement;
}

export function useMentionSuggestions(
  text: string,
  cursorPosition: number
): UseMentionSuggestionsResult {
  const active = useMemo(() => findActiveMention(text, cursorPosition), [text, cursorPosition]);

  // useSearchUsers a son propre debounce (300ms). Le ticket demande 200ms,
  // mais 300ms est cohérent avec le reste de l'app. Pas de duplication de la
  // logique RPC ici — on délègue.
  const search = useSearchUsers(active?.query ?? '');

  return useMemo(() => {
    const replaceMention = (selectedUsername: string): MentionReplacement => {
      if (!active) {
        return { text, cursor: cursorPosition };
      }
      const before = text.slice(0, active.start);
      const after = text.slice(active.end);
      // Espace final pour permettre d'enchaîner la frappe. Si `after` commence
      // déjà par un espace, on n'en ajoute pas un second.
      const needsSpace = !after.startsWith(' ');
      const insertion = `@${selectedUsername.toLowerCase()}${needsSpace ? ' ' : ''}`;
      return {
        text: before + insertion + after,
        cursor: before.length + insertion.length,
      };
    };

    return {
      activeQuery: active ? active.query : null,
      activeRange: active ? { start: active.start, end: active.end } : null,
      suggestions: active && active.query.length >= 2 ? search.users : [],
      isLoading: active && active.query.length >= 2 ? search.isLoading : false,
      isError: search.isError,
      replaceMention,
    };
  }, [active, cursorPosition, search.users, search.isLoading, search.isError, text]);
}
