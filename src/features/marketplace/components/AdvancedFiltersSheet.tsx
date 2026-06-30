// AdvancedFiltersSheet — E7-11 (#242)
//
// Modale bottom-sheet pour les filtres avancés Marketplace : tri, fourchette
// de prix, état (si product). La distance est laissée hors-scope MVP
// (nécessite geo + index spatial, à reprendre quand on ajoutera la
// localisation user).
//
// State pattern :
//   - L'écran parent (grille) garde la source de vérité des filtres
//   - Cette modale reçoit les filtres courants + 2 callbacks (apply / reset)
//   - State local pendant l'édition → on n'apply que sur tap explicite
//   - Reset → on remet les valeurs par défaut mais on n'apply que si l'user
//     tape ensuite Appliquer (pattern Leboncoin)
//
// Pas de slider double : on utilise 2 inputs numériques (pattern marketplace
// standard, évite d'ajouter une lib + accessibilité plus simple).

import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Input, Sheet, Text, View, XStack, YStack } from 'tamagui';

import type {
  ListingCategory,
  ListingCondition,
  ListingSort,
  ListingsFilters,
} from '../hooks/useListings';

import { SegmentedChoice } from './SegmentedChoice';

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'recent', label: 'Récent' },
  { value: 'price_asc', label: 'Prix ↑' },
  { value: 'price_desc', label: 'Prix ↓' },
  { value: 'popular', label: 'Populaire' },
];

const CONDITION_OPTIONS: { value: ListingCondition; label: string }[] = [
  { value: 'neuf', label: 'Neuf' },
  { value: 'tres_bon_etat', label: 'Très bon état' },
  { value: 'bon_etat', label: 'Bon état' },
  { value: 'occasion', label: 'Occasion' },
];

export interface AdvancedFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filtres actuellement appliqués (initial state de la modale). */
  current: ListingsFilters;
  /** Catégorie active sur la grille (pour masquer la section État si Service). */
  activeCategory: ListingCategory | null;
  /** Appelé avec les nouveaux filtres au tap Appliquer (ferme aussi la sheet). */
  onApply: (
    next: Pick<ListingsFilters, 'sort' | 'minPriceCents' | 'maxPriceCents' | 'condition'>
  ) => void;
}

function centsToEuroString(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '';
  const euros = cents / 100;
  // Affichage sans .00 inutile
  return Number.isInteger(euros) ? String(euros) : euros.toFixed(2).replace('.', ',');
}

function parsePriceInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  // Accepte virgule ou point comme séparateur décimal (saisie FR).
  const normalized = trimmed.replace(',', '.');
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

export function AdvancedFiltersSheet({
  open,
  onOpenChange,
  current,
  activeCategory,
  onApply,
}: AdvancedFiltersSheetProps) {
  const [sort, setSort] = useState<ListingSort>(current.sort ?? 'recent');
  const [condition, setCondition] = useState<ListingCondition | null>(current.condition ?? null);
  const [minPrice, setMinPrice] = useState<string>(centsToEuroString(current.minPriceCents));
  const [maxPrice, setMaxPrice] = useState<string>(centsToEuroString(current.maxPriceCents));
  const [priceError, setPriceError] = useState<string | null>(null);

  // Reset le state local quand la sheet (re)s'ouvre : on resynchronise avec
  // les filtres courants pour ne pas afficher des valeurs périmées d'une
  // session précédente.
  useEffect(() => {
    if (open) {
      setSort(current.sort ?? 'recent');
      setCondition(current.condition ?? null);
      setMinPrice(centsToEuroString(current.minPriceCents));
      setMaxPrice(centsToEuroString(current.maxPriceCents));
      setPriceError(null);
    }
  }, [open, current.sort, current.condition, current.minPriceCents, current.maxPriceCents]);

  const handleReset = () => {
    setSort('recent');
    setCondition(null);
    setMinPrice('');
    setMaxPrice('');
    setPriceError(null);
  };

  const handleApply = () => {
    const minCents = parsePriceInput(minPrice);
    const maxCents = parsePriceInput(maxPrice);

    // Validation : si les 2 sont définis, min doit être <= max.
    if (minCents != null && maxCents != null && minCents > maxCents) {
      setPriceError('Le prix min doit être inférieur au prix max.');
      return;
    }
    setPriceError(null);

    onApply({
      sort,
      // Section État masquée si la catégorie active est "service" : on force
      // condition à null pour éviter de propager une valeur fantôme depuis
      // une session précédente.
      condition: activeCategory === 'service' ? null : condition,
      minPriceCents: minCents,
      maxPriceCents: maxCents,
    });
    onOpenChange(false);
  };

  const showConditionSection = activeCategory !== 'service';

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[72]} dismissOnSnapToBottom>
      <Sheet.Overlay
        animation="lazy"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(0,0,0,0.55)"
      />
      <Sheet.Handle />
      <Sheet.Frame
        backgroundColor="$background"
        borderTopLeftRadius={20}
        borderTopRightRadius={20}
        paddingHorizontal={20}
        paddingTop={16}
        paddingBottom={28}
      >
        <YStack gap={20} flex={1}>
          <XStack alignItems="center" justifyContent="space-between">
            <Text fontSize={18} fontWeight="800" color="$color">
              Filtres
            </Text>
            <Text
              fontSize={13}
              fontWeight="700"
              color="$accentNeon"
              onPress={handleReset}
              accessibilityRole="button"
              accessibilityLabel="Réinitialiser les filtres"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              Réinitialiser
            </Text>
          </XStack>

          {/* Trier par */}
          <YStack gap={10}>
            <Text fontSize={14} fontWeight="700" color="$color">
              Trier par
            </Text>
            <SegmentedChoice<ListingSort> options={SORT_OPTIONS} value={sort} onChange={setSort} />
          </YStack>

          {/* Fourchette de prix */}
          <YStack gap={10}>
            <Text fontSize={14} fontWeight="700" color="$color">
              Prix
            </Text>
            <XStack alignItems="center" gap={10}>
              <XStack
                flex={1}
                alignItems="center"
                backgroundColor="$surface"
                borderRadius="$md"
                paddingHorizontal={12}
                height={44}
              >
                <Input
                  flex={1}
                  value={minPrice}
                  onChangeText={(v) => {
                    setMinPrice(v);
                    setPriceError(null);
                  }}
                  placeholder="Min"
                  placeholderTextColor="$placeholderColor"
                  keyboardType="decimal-pad"
                  color="$color"
                  backgroundColor="transparent"
                  borderWidth={0}
                  paddingHorizontal={0}
                  height={44}
                  fontSize={15}
                  accessibilityLabel="Prix minimum en euros"
                />
                <Text fontSize={14} color="$textSecondary" fontWeight="600">
                  €
                </Text>
              </XStack>
              <Text fontSize={14} color="$textSecondary">
                à
              </Text>
              <XStack
                flex={1}
                alignItems="center"
                backgroundColor="$surface"
                borderRadius="$md"
                paddingHorizontal={12}
                height={44}
              >
                <Input
                  flex={1}
                  value={maxPrice}
                  onChangeText={(v) => {
                    setMaxPrice(v);
                    setPriceError(null);
                  }}
                  placeholder="Max"
                  placeholderTextColor="$placeholderColor"
                  keyboardType="decimal-pad"
                  color="$color"
                  backgroundColor="transparent"
                  borderWidth={0}
                  paddingHorizontal={0}
                  height={44}
                  fontSize={15}
                  accessibilityLabel="Prix maximum en euros"
                />
                <Text fontSize={14} color="$textSecondary" fontWeight="600">
                  €
                </Text>
              </XStack>
            </XStack>
            {priceError ? (
              <Text fontSize={12} color="#FF6B6B">
                {priceError}
              </Text>
            ) : null}
          </YStack>

          {/* État (masqué si Service actif) */}
          {showConditionSection ? (
            <YStack gap={10}>
              <Text fontSize={14} fontWeight="700" color="$color">
                État
              </Text>
              <SegmentedChoice<ListingCondition>
                options={CONDITION_OPTIONS}
                value={condition}
                onChange={setCondition}
                allowDeselect
                onDeselect={() => setCondition(null)}
              />
            </YStack>
          ) : null}

          {/* Spacer */}
          <View flex={1} />

          {/* CTA Appliquer */}
          <Text
            fontSize={15}
            fontWeight="800"
            color="#000000"
            backgroundColor="#10D970"
            paddingVertical={14}
            textAlign="center"
            borderRadius={9999}
            accessibilityRole="button"
            accessibilityLabel="Appliquer les filtres"
            onPress={handleApply}
            style={styles.cta}
          >
            Appliquer
          </Text>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cta: {
    overflow: 'hidden',
  },
});
