// CategoryChips — E7-10
//
// Chips de catégorie sous la barre de filtres rapides. Mappées sur l'enum
// `listing_category` côté DB ('product' | 'service'). Une chip "Tout" pour
// désactiver le filtre.

import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'tamagui';

import { useTranslations } from '@/i18n';

import type { ListingCategory } from '../hooks/useListings';

export interface CategoryChipsProps {
  selected: ListingCategory | null;
  onSelect: (category: ListingCategory | null) => void;
}

export function CategoryChips({ selected, onSelect }: CategoryChipsProps) {
  const t = useTranslations();

  // Libellés d'UI issus du dico ; les ids restent les valeurs d'enum métier DB.
  const categories: { id: ListingCategory | null; label: string }[] = [
    { id: null, label: t.marketplace.categoryChips.all },
    { id: 'product', label: t.marketplace.categoryChips.products },
    { id: 'service', label: t.marketplace.categoryChips.services },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      // flexGrow:0 + maxHeight pour éviter l'expansion verticale sur Android
      // (bug courant des ScrollView horizontaux dans des conteneurs flex).
      style={styles.scroll}
    >
      {categories.map((cat) => {
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
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 48,
  },
});
