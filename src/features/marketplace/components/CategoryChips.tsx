// CategoryChips — E7-10
//
// Chips de catégorie sous la barre de filtres rapides. Mappées sur l'enum
// `listing_category` côté DB ('product' | 'service'). Une chip "Tout" pour
// désactiver le filtre.

import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'tamagui';

import type { ListingCategory } from '../hooks/useListings';

const CATEGORIES: { id: ListingCategory | null; label: string }[] = [
  { id: null, label: 'Tout' },
  { id: 'product', label: 'Produits' },
  { id: 'service', label: 'Services' },
];

export interface CategoryChipsProps {
  selected: ListingCategory | null;
  onSelect: (category: ListingCategory | null) => void;
}

export function CategoryChips({ selected, onSelect }: CategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {CATEGORIES.map((cat) => {
        const isSelected = selected === cat.id;
        return (
          <Pressable
            key={String(cat.id)}
            onPress={() => onSelect(cat.id)}
            accessibilityRole="tab"
            accessibilityLabel={cat.label}
            accessibilityState={{ selected: isSelected }}
            style={[styles.chip, isSelected ? styles.chipActive : null]}
          >
            <Text
              fontSize={13}
              fontWeight={isSelected ? '700' : '500'}
              color={isSelected ? '#000000' : '#FFFFFF'}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#1A1A1A',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
});
