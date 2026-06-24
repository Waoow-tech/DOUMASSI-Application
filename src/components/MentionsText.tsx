// MentionsText — Sprint 6, ticket #213.
//
// Rend un texte (post, commentaire, message) en parsant les `@username` et
// en les transformant en spans cliquables qui ouvrent le profil de l'utilisateur.
//
// Pattern reconnu : `@` suivi de 3 à 30 caractères [a-zA-Z0-9_]. Identique au
// helper SQL `fn_extract_mentions` côté serveur (migration 20260624140100)
// pour que ce qui est rendu cliquable côté client corresponde exactement à
// ce qui déclenche une notification côté DB.
//
// Le composant utilise le `Text` natif de React Native (pas Tamagui Text) pour
// rester compatible avec `numberOfLines`, `onTextLayout` et le rendu inline
// des sous-`Text` (qui est nécessaire pour mélanger texte normal et mentions
// stylées dans la même ligne).
//
// Au tap d'une mention :
//   1. Si le parent fournit `onPressMention(username)`, on délègue.
//   2. Sinon, on navigue vers `/profile/u/{username}` (route helper qui
//      résout username → id puis redirige vers le screen profile).

import { router } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import {
  Text,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextLayoutEventData,
  type TextStyle,
} from 'react-native';

// Pattern identique à `fn_extract_mentions` côté SQL. Le `g` flag est obligatoire
// pour récupérer tous les matches via `matchAll`.
const MENTION_REGEX = /@([A-Za-z0-9_]{3,30})/g;

// Couleur accent DOUMASSI (#10D970). On garde l'hex en dur pour ne pas
// dépendre du theme Tamagui depuis un `Text` natif RN.
const DEFAULT_MENTION_COLOR = '#10D970';

type Fragment = { kind: 'text'; value: string } | { kind: 'mention'; username: string };

function parseMentions(content: string): Fragment[] {
  if (!content) return [];

  const fragments: Fragment[] = [];
  let lastIndex = 0;

  // matchAll garantit l'ordre + l'index de chaque match
  for (const match of content.matchAll(MENTION_REGEX)) {
    const matchIndex = match.index ?? 0;
    const fullMatch = match[0];
    const username = match[1];
    if (!username) continue;

    if (matchIndex > lastIndex) {
      fragments.push({ kind: 'text', value: content.slice(lastIndex, matchIndex) });
    }
    fragments.push({ kind: 'mention', username });
    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < content.length) {
    fragments.push({ kind: 'text', value: content.slice(lastIndex) });
  }

  return fragments;
}

export interface MentionsTextProps {
  content: string;
  /** Style du texte de base (couleur, fontSize, lineHeight, etc.) */
  style?: StyleProp<TextStyle>;
  /** Style spécifique des mentions. Mergé par-dessus la couleur par défaut. */
  mentionStyle?: StyleProp<TextStyle>;
  /** Couleur des mentions. Défaut: vert accent DOUMASSI. */
  mentionColor?: string;
  /** Souligner les mentions. Défaut: false. */
  mentionUnderline?: boolean;
  /** Handler custom au tap. Défaut: router.push vers /profile/u/[username]. */
  onPressMention?: (username: string) => void;
  numberOfLines?: number;
  onTextLayout?: (event: NativeSyntheticEvent<TextLayoutEventData>) => void;
  testID?: string;
  accessibilityLabel?: string;
}

function MentionsTextComponent({
  content,
  style,
  mentionStyle,
  mentionColor = DEFAULT_MENTION_COLOR,
  mentionUnderline = false,
  onPressMention,
  numberOfLines,
  onTextLayout,
  testID,
  accessibilityLabel,
}: MentionsTextProps) {
  const fragments = useMemo(() => parseMentions(content ?? ''), [content]);

  const handlePress = useCallback(
    (username: string) => {
      if (onPressMention) {
        onPressMention(username);
        return;
      }
      router.push(`/profile/u/${username.toLowerCase()}`);
    },
    [onPressMention]
  );

  // Cas sans mention : on évite de wrapper en sous-Text pour ne rien casser
  // (parents qui font `<MentionsText>` à la place d'un `<Text>` brut).
  if (fragments.length === 0 || fragments.every((f) => f.kind === 'text')) {
    return (
      <Text
        style={style}
        numberOfLines={numberOfLines}
        onTextLayout={onTextLayout}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </Text>
    );
  }

  const mentionTextStyle: TextStyle = {
    color: mentionColor,
    fontWeight: '600',
    ...(mentionUnderline ? { textDecorationLine: 'underline' } : null),
  };

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      onTextLayout={onTextLayout}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      {fragments.map((fragment, index) => {
        if (fragment.kind === 'text') {
          return <Text key={`t-${index}`}>{fragment.value}</Text>;
        }
        return (
          <Text
            key={`m-${index}`}
            style={[mentionTextStyle, mentionStyle]}
            onPress={() => handlePress(fragment.username)}
            suppressHighlighting
            accessibilityRole="link"
            accessibilityLabel={`Profil de ${fragment.username}`}
          >
            @{fragment.username}
          </Text>
        );
      })}
    </Text>
  );
}

export const MentionsText = memo(MentionsTextComponent);

// Export du parser pour réutilisation (tests, validation Zod côté schémas).
export { parseMentions, MENTION_REGEX };
