// TaxonomyChips — E9-04
//
// Rangée horizontale scrollable de chips pour filtrer par niveau / matière /
// type. Composant générique : une chip "Tout" (valeur null) + une chip par
// option. Réutilisé pour les 3 axes de la bibliothèque.
//
// Note layout Android : flexGrow:0 + maxHeight sur le ScrollView pour éviter
// l'expansion verticale (même correctif que QuickFiltersBar marketplace).

import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'tamagui';

export interface TaxonomyChipOption {
  value: string;
  label: string;
}

export interface TaxonomyChipsProps {
  options: TaxonomyChipOption[];
  /** Valeur sélectionnée, ou null pour "Tout". */
  selected: string | null;
  onSelect: (value: string | null) => void;
  /** Libellé de la chip "tout" (ex. "Tous", "Toutes", "Tous types"). */
  allLabel?: string;
}

export function TaxonomyChips({
  options,
  selected,
  onSelect,
  allLabel = 'Tous',
}: TaxonomyChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
    >
      <Chip label={allLabel} active={selected === null} onPress={() => onSelect(null)} />
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          active={selected === opt.value}
          onPress={() => onSelect(opt.value)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <Text
        fontSize={13}
        fontWeight={active ? '700' : '500'}
        color={active ? '#000000' : '#FFFFFF'}
      >
        {label}
      </Text>
    </Pressable>
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
    alignItems: 'center',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 44,
  },
});
