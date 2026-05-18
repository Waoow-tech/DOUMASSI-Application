// Layout TabBar 5 onglets — Sprint 3 E8-04
// Onglets : Home / Bell / Hash (Studio AI) / Send (Messages) / User (Profile)
// Auth guard + redirect vers welcome/onboarding si pas connecté.

import { Redirect, Tabs } from 'expo-router';
import { Bell, Hash, Home, Send, User } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import GuardLoader from '@/components/GuardLoader';
import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';

const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = '#A0A0A0';
const SURFACE = '#1A1A1A';
const BORDER = '#262626';

type TabIconProps = {
  Icon: typeof Home;
  focused: boolean;
};

function TabIcon({ Icon, focused }: TabIconProps) {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Icon
        size={24}
        color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
        strokeWidth={focused ? 2.2 : 1.8}
      />
    </View>
  );
}

export default function TabsLayout() {
  const status = useAuthGuard();

  if (status === 'loading') {
    return <GuardLoader />;
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (status === 'incomplete' || status === 'onboarding') {
    return <Redirect href="/(onboarding)" />;
  }

  if (status === 'incomplete-google') {
    return <Redirect href="/(onboarding)/complete-account" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
          tabBarAccessibilityLabel: 'Accueil',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={Bell} focused={focused} />,
          tabBarAccessibilityLabel: 'Notifications',
        }}
      />
      <Tabs.Screen
        name="studio-ai"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={Hash} focused={focused} />,
          tabBarAccessibilityLabel: 'Studio AI',
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={Send} focused={focused} />,
          tabBarAccessibilityLabel: 'Messages',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />,
          tabBarAccessibilityLabel: 'Mon profil',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000000',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
  },
  iconWrapper: {
    width: 48,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  iconWrapperActive: {
    backgroundColor: SURFACE,
  },
});
