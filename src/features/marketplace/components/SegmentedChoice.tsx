// SegmentedChoice — E7-14 (#245)
//
// Composant générique de choix segmenté (boutons exclusifs alignés
// horizontalement). Utilisé pour Catégorie (product/service) et État
// (4 valeurs). Pattern volontairement minimaliste : pas d'icône — texte FR
// suffit pour l'usage MVP.

import { Pressable, StyleSheet } from 'react-native';
import { Text, XStack } from 'tamagui';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedChoiceProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (next: T) => void;
  /** Permet la désélection (tap sur la valeur active la repasse à null). */
  allowDeselect?: boolean;
  onDeselect?: () => void;
  disabled?: boolean;
}

export function SegmentedChoice<T extends string>({
  options,
  value,
  onChange,
  allowDeselect = false,
  onDeselect,
  disabled = false,
}: SegmentedChoiceProps<T>) {
  return (
    <XStack flexWrap="wrap" gap={8}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (disabled) return;
              if (isActive && allowDeselect) {
                onDeselect?.();
              } else {
                onChange(opt.value);
              }
            }}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: isActive, disabled }}
            style={[styles.chip, isActive ? styles.chipActive : null]}
          >
            <Text
              fontSize={13}
              fontWeight={isActive ? '700' : '500'}
              color={isActive ? '#000000' : '#FFFFFF'}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </XStack>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: '#1A1A1A',
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
  },
});
