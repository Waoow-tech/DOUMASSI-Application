// RewardToast — E12-08
//
// Toast overlay « +N Dcoins gagnés ! » affiché après un gain. Monté une fois au
// niveau du layout authentifié ((tabs)/_layout). S'auto-masque après 3 s.

import { Coins } from 'lucide-react-native';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack } from 'tamagui';

import { useTranslations } from '@/i18n';
import { useRewardToastStore } from '@/stores/rewardToastStore';

const VISIBLE_MS = 3000;

export function RewardToast() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const amount = useRewardToastStore((s) => s.amount);
  const hide = useRewardToastStore((s) => s.hide);

  useEffect(() => {
    if (amount === null) return;
    const id = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(id);
  }, [amount, hide]);

  if (amount === null) return null;

  return (
    <XStack
      position="absolute"
      top={insets.top + 12}
      left={16}
      right={16}
      zIndex={1000}
      backgroundColor="$accentNeon"
      borderRadius="$10"
      paddingVertical={12}
      paddingHorizontal={16}
      alignItems="center"
      justifyContent="center"
      gap={8}
      animation="quick"
      enterStyle={{ opacity: 0, y: -12 }}
      exitStyle={{ opacity: 0, y: -12 }}
      onPress={hide}
      pressStyle={{ opacity: 0.9 }}
    >
      <Coins size={18} color="#000000" />
      <Text fontSize={15} fontWeight="800" color="#000000">
        {t.wallet.rewardToast(amount)}
      </Text>
    </XStack>
  );
}
