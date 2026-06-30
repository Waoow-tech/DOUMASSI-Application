// QuickFiltersBar — E7-10
//
// Barre horizontale scrollable des filtres rapides : Trier / Prix / État /
// Distance + icône réglages ronde à droite (qui ouvre les filtres avancés
// en modale, livrés dans E7-11).
//
// Pour l'instant les boutons rapides sont visuels et ouvrent tous la modale
// d'avancés ; ils servent surtout de raccourcis visuels. Quand E7-11 sera
// livré, on pourra brancher chacun pour pré-ouvrir la modale sur la section
// correspondante.

import { ChevronDown, MapPin, SlidersHorizontal } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text, View, XStack } from 'tamagui';

export interface QuickFiltersBarProps {
  /** Vrai si des filtres avancés sont actifs → on highlight le bouton réglages. */
  hasActiveAdvancedFilters?: boolean;
  /** Ouvre la modale de filtres avancés (E7-11). */
  onOpenAdvanced: () => void;
}

const QUICK_FILTERS: { id: 'sort' | 'price' | 'condition' | 'distance'; label: string }[] = [
  { id: 'sort', label: 'Trier' },
  { id: 'price', label: 'Prix' },
  { id: 'condition', label: 'État' },
  { id: 'distance', label: 'Distance' },
];

export function QuickFiltersBar({
  hasActiveAdvancedFilters = false,
  onOpenAdvanced,
}: QuickFiltersBarProps) {
  return (
    <XStack alignItems="center" gap={8} paddingHorizontal={12} paddingVertical={8}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_FILTERS.map((filter) => (
          <Pressable
            key={filter.id}
            onPress={onOpenAdvanced}
            accessibilityRole="button"
            accessibilityLabel={`Filtre ${filter.label}`}
            accessibilityHint="Tap pour ouvrir les filtres avancés"
            style={styles.pill}
          >
            {filter.id === 'distance' ? <MapPin size={14} color="#FFFFFF" strokeWidth={2} /> : null}
            <Text fontSize={13} fontWeight="600" color="#FFFFFF">
              {filter.label}
            </Text>
            <ChevronDown size={14} color="#A0A0A0" strokeWidth={2} />
          </Pressable>
        ))}
      </ScrollView>

      {/* Bouton rond réglages — ouvre la modale d'avancés */}
      <Pressable
        onPress={onOpenAdvanced}
        accessibilityRole="button"
        accessibilityLabel="Filtres avancés"
        accessibilityHint="Tap pour ouvrir tous les filtres"
        accessibilityState={{ selected: hasActiveAdvancedFilters }}
        style={[
          styles.advancedButton,
          hasActiveAdvancedFilters ? styles.advancedButtonActive : null,
        ]}
      >
        <SlidersHorizontal
          size={18}
          color={hasActiveAdvancedFilters ? '#000000' : '#FFFFFF'}
          strokeWidth={2.2}
        />
        {hasActiveAdvancedFilters ? (
          <View
            position="absolute"
            top={-2}
            right={-2}
            width={10}
            height={10}
            borderRadius={5}
            backgroundColor="#10D970"
          />
        ) : null}
      </Pressable>
    </XStack>
  );
}

const styles = StyleSheet.create({
  advancedButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedButtonActive: {
    backgroundColor: '#10D970',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#1A1A1A',
    marginRight: 8,
  },
  scrollContent: {
    alignItems: 'center',
    paddingRight: 4,
  },
});
