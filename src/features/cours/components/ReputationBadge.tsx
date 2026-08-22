// ReputationBadge — E9-15 (#275)
//
// Petit badge de palier de réputation (Contributeur / confirmé / Expert).
// Rien affiché pour le palier 'none' (auteur sans ressource active).

import { Award, Sparkles, Star } from 'lucide-react-native';
import { View, XStack, Text } from 'tamagui';

import { useTranslations } from '@/i18n';

import { type ReputationTier } from '../hooks/useAuthorReputation';

const TIER_STYLE: Record<
  Exclude<ReputationTier, 'none'>,
  { bg: string; color: string; Icon: typeof Star }
> = {
  contributeur: { bg: '#1A1A1A', color: '#A0A0A0', Icon: Star },
  confirme: { bg: '#12203A', color: '#3B82F6', Icon: Award },
  expert: { bg: '#12291D', color: '#FFFFFF', Icon: Sparkles },
};

export interface ReputationBadgeProps {
  tier: ReputationTier;
  size?: 'sm' | 'md';
}

export function ReputationBadge({ tier, size = 'md' }: ReputationBadgeProps) {
  const t = useTranslations();
  if (tier === 'none') return null;
  const style = TIER_STYLE[tier];
  const { Icon } = style;
  const iconSize = size === 'sm' ? 10 : 12;
  const fontSize = size === 'sm' ? 10 : 11;

  return (
    <View
      backgroundColor={style.bg}
      paddingHorizontal={size === 'sm' ? 6 : 8}
      paddingVertical={size === 'sm' ? 2 : 3}
      borderRadius={9999}
    >
      <XStack alignItems="center" gap={4}>
        <Icon size={iconSize} color={style.color} strokeWidth={2.2} />
        <Text fontSize={fontSize} fontWeight="700" color={style.color}>
          {t.cours.reputation[tier]}
        </Text>
      </XStack>
    </View>
  );
}
