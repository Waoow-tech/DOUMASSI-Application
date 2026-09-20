// Toast — E2-13
//
// Rendu visuel du toast applicatif global (cf. toastStore). Monté UNE seule fois
// dans le root layout (app/_layout.tsx) pour couvrir tous les écrans, y compris
// les écrans d'auth non authentifiés. S'auto-masque après VISIBLE_MS.
//
// Identité N&B : le rouge $danger est un signal de statut (erreur), pas une
// couleur d'accent de marque — cf. mémoire « identité noir & blanc ».

import { AlertCircle, CheckCircle2, Info } from 'lucide-react-native';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack } from 'tamagui';

import { useToastStore, type ToastVariant } from '@/stores/toastStore';

const VISIBLE_MS = 4000;

// Styles par variante (fond, couleur du texte/icône).
const VARIANT_STYLE: Record<ToastVariant, { bg: string; fg: string }> = {
  error: { bg: '$danger', fg: '#FFFFFF' },
  success: { bg: '#FFFFFF', fg: '#000000' },
  info: { bg: '$surfaceElevated', fg: '#FFFFFF' },
};

function VariantIcon({ variant, color }: { variant: ToastVariant; color: string }) {
  if (variant === 'success') return <CheckCircle2 size={18} color={color} />;
  if (variant === 'info') return <Info size={18} color={color} />;
  return <AlertCircle size={18} color={color} />;
}

export function Toast() {
  const insets = useSafeAreaInsets();
  const current = useToastStore((s) => s.current);
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(id);
  }, [current, hide]);

  if (!current) return null;

  const style = VARIANT_STYLE[current.variant];

  return (
    <XStack
      position="absolute"
      top={insets.top + 12}
      left={16}
      right={16}
      zIndex={2000}
      backgroundColor={style.bg}
      borderRadius="$6"
      paddingVertical={12}
      paddingHorizontal={16}
      alignItems="center"
      gap={10}
      animation="quick"
      enterStyle={{ opacity: 0, y: -12 }}
      exitStyle={{ opacity: 0, y: -12 }}
      onPress={hide}
      pressStyle={{ opacity: 0.9 }}
      // Ombre douce pour détacher le toast du fond
      shadowColor="#000000"
      shadowOpacity={0.35}
      shadowRadius={12}
      shadowOffset={{ width: 0, height: 4 }}
      elevation={6}
    >
      <VariantIcon variant={current.variant} color={style.fg} />
      <Text flex={1} fontSize={14} fontWeight="600" color={style.fg}>
        {current.message}
      </Text>
    </XStack>
  );
}
