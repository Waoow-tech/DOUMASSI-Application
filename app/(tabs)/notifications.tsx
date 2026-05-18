// Tab Bell — placeholder MVP, vrai écran livré en E4-17 (Sprint 3).

import { Bell } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Text, YStack } from 'tamagui';

export default function NotificationsRoute() {
  return (
    <View style={styles.screen}>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" paddingHorizontal="$6">
        <Bell size={64} color="#A0A0A0" strokeWidth={1.5} />
        <Text color="$color" fontSize={18} fontWeight="700" textAlign="center">
          Notifications bientôt disponibles
        </Text>
        <Text color="$textSecondary" fontSize={14} textAlign="center">
          Vos likes, commentaires et nouveaux abonnés apparaîtront ici.
        </Text>
      </YStack>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
