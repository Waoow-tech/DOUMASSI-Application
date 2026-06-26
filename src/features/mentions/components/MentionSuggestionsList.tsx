// MentionSuggestionsList — Sprint 6, ticket #213 (PR B).
//
// Dropdown horizontal de suggestions affichée AU-DESSUS d'un composer texte
// quand l'utilisateur est en train de taper `@xxx`. Tap sur une suggestion =
// insère `@username ` à la position du curseur (via le helper du hook).
//
// On utilise un ScrollView horizontal de "chips" plutôt qu'une liste verticale :
//   - Prend peu de hauteur (~52px) → ne mange pas l'écran
//   - Lecture rapide
//   - Cohérent avec l'UX des composers modernes (Twitter, Discord)
//
// Hauteur fixée pour éviter les sauts de layout. Si pas de suggestions
// (chargement, vide, query trop courte), on n'affiche pas le composant
// (à gérer côté parent avec un `activeQuery !== null` mais on rend quand
// même en mode loading pour montrer un feedback visuel).

import { Image } from 'expo-image';
import { User as UserIcon } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';

import type { SearchUserResult } from '@/features/profile/hooks/useSearchUsers';

export interface MentionSuggestionsListProps {
  suggestions: SearchUserResult[];
  isLoading: boolean;
  /** Vrai dès qu'une mention est en cours (même si query trop courte). */
  visible: boolean;
  onSelect: (user: SearchUserResult) => void;
}

const HEIGHT = 52;
const AVATAR_SIZE = 28;

export function MentionSuggestionsList({
  suggestions,
  isLoading,
  visible,
  onSelect,
}: MentionSuggestionsListProps) {
  if (!visible) return null;

  // Cas chargement : on affiche un spinner pour signaler à l'utilisateur que
  // sa frappe est captée. Sinon on aurait l'impression que la dropdown bug.
  if (isLoading) {
    return (
      <XStack
        height={HEIGHT}
        backgroundColor="$surface"
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor="$borderColor"
        alignItems="center"
        justifyContent="center"
        gap="$2"
      >
        <Spinner size="small" color="$accentNeon" />
        <Text fontSize={13} color="$textSecondary">
          Recherche…
        </Text>
      </XStack>
    );
  }

  // Cas vide : aucune suggestion (query > 2 chars mais 0 résultat). On affiche
  // un placeholder discret pour signaler "rien trouvé" sans masquer le texte.
  if (suggestions.length === 0) {
    return (
      <XStack
        height={HEIGHT}
        backgroundColor="$surface"
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor="$borderColor"
        alignItems="center"
        justifyContent="center"
        paddingHorizontal="$3"
      >
        <Text fontSize={13} color="$textSecondary">
          Aucun utilisateur trouvé
        </Text>
      </XStack>
    );
  }

  return (
    <XStack
      height={HEIGHT}
      backgroundColor="$surface"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderColor"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map((user) => (
          <Pressable
            key={user.id}
            onPress={() => onSelect(user)}
            accessibilityRole="button"
            accessibilityLabel={`Mentionner @${user.username}`}
            style={styles.chip}
          >
            <YStack
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              borderRadius={9999}
              backgroundColor="$surfaceElevated"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
            >
              {user.avatar_url ? (
                <Image
                  source={{ uri: user.avatar_url }}
                  style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                  contentFit="cover"
                />
              ) : (
                <UserIcon size={14} color="#A0A0A0" />
              )}
            </YStack>
            <Text fontSize={14} fontWeight="600" color="$color">
              @{user.username}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </XStack>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#252525',
    borderRadius: 9999,
  },
  scrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
});
