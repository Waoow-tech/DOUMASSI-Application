// Segmented control des onglets profil : Vidéos / Posts / Boutique.
// Identique entre Mon profil et Profil autre.

import { Play, Store, UserSquare2 } from 'lucide-react-native';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { XStack } from 'tamagui';

export type ProfileTab = 'reels' | 'grid' | 'shop';

interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

function TabButton({
  icon,
  isActive,
  onPress,
}: {
  icon: React.ReactNode;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
    >
      {icon}
    </TouchableOpacity>
  );
}

export function ProfileTabs({ active, onChange }: ProfileTabsProps) {
  return (
    <XStack marginTop="$4" borderTopWidth={0.5} borderBottomWidth={0.5} borderColor="$borderColor">
      <TabButton
        icon={<Play size={22} color={active === 'reels' ? '#FFFFFF' : '#A0A0A0'} />}
        isActive={active === 'reels'}
        onPress={() => onChange('reels')}
      />
      <TabButton
        icon={<UserSquare2 size={22} color={active === 'grid' ? '#FFFFFF' : '#A0A0A0'} />}
        isActive={active === 'grid'}
        onPress={() => onChange('grid')}
      />
      <TabButton
        icon={<Store size={22} color={active === 'shop' ? '#FFFFFF' : '#A0A0A0'} />}
        isActive={active === 'shop'}
        onPress={() => onChange('shop')}
      />
    </XStack>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#FFFFFF',
  },
});
