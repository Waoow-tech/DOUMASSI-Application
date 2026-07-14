// Layout TabBar 5 onglets — Sprint 3 E8-04
// Onglets : Home / Bell / Hash (Doumassi AI) / Send (Messages) / User (Profile)
// Auth guard + redirect vers welcome/onboarding si pas connecté.

import { Redirect, Tabs } from 'expo-router';
import { Bell, Hash, Home, Send, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GuardLoader from '@/components/GuardLoader';
import { PendingDeletionModal } from '@/features/auth/components/PendingDeletionModal';
import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import { usePendingDeletionReminder } from '@/features/auth/hooks/usePendingDeletionReminder';
import { usePushToken } from '@/features/auth/hooks/usePushToken';
import { useIncomingCallListener } from '@/features/calls/hooks/useIncomingCallListener';
import { useNotificationsUnreadCount } from '@/features/notifications/hooks/useNotifications';
import { usePushNotificationsHandler } from '@/features/notifications/hooks/usePushNotificationsHandler';
import { useTranslations } from '@/i18n';
import { supabase } from '@/lib/supabase';

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

// Sous-composant rendu UNIQUEMENT après le guard auth — c'est ici qu'on peut
// appeler `useNotificationsUnreadCount` sans risquer de tirer la RPC avant
// qu'il y ait une session valide (et sans violer les règles des hooks au
// niveau du parent qui short-circuit avec des Redirect).
function AuthenticatedTabs() {
  const t = useTranslations();
  const unreadCount = useNotificationsUnreadCount();
  const insets = useSafeAreaInsets();
  // E4-14 : enregistrement du push token + handler de tap. Montés ici
  // (sous le guard auth) car on a besoin d'une session valide pour le
  // PATCH profiles.push_token, et il est inutile d'écouter les taps
  // avant que l'app soit dans son état authentifié.
  usePushToken();
  usePushNotificationsHandler();

  // Ticket #214 : rappel de suppression de compte programmée. La modale
  // s'affiche 1× par session si une `deletion_requests` active existe pour
  // l'user courant.
  const deletionReminder = usePendingDeletionReminder();

  // Ticket #233 : listener Realtime pour les appels entrants. Quand un autre
  // user crée un call dans une de mes conversations → push vers l'écran
  // ringtone (Accept/Decline).
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setMeId(data.session?.user.id ?? null);
    })();
  }, []);
  useIncomingCallListener(meId);

  // Tab bar dynamique : on remonte la barre de la zone safe area système
  // (gesture navigation Android moderne + home indicator iOS). Sans ça,
  // la barre est posée au ras du bas → icônes coupées par la zone gestes.
  const tabBarStyle = [
    styles.tabBar,
    {
      height: styles.tabBar.height + insets.bottom,
      paddingBottom: Math.max(styles.tabBar.paddingBottom, insets.bottom + 4),
    },
  ];

  return (
    <>
      {deletionReminder.shouldShow && deletionReminder.request ? (
        <PendingDeletionModal
          open={deletionReminder.shouldShow}
          request={deletionReminder.request}
          onClose={deletionReminder.dismiss}
        />
      ) : null}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: tabBarStyle,
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: INACTIVE_COLOR,
        }}
      >
        <Tabs.Screen
          name="feed"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
            tabBarAccessibilityLabel: t.common.tabs.feed,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon Icon={Bell} focused={focused} />,
            tabBarAccessibilityLabel: t.common.tabs.notifications,
            // Cap à "99+" pour éviter un débordement visuel du badge sur les
            // gros volumes (la cible MVP n'y arrivera pas mais c'est défensif).
            tabBarBadge: unreadCount > 99 ? '99+' : unreadCount > 0 ? unreadCount : undefined,
          }}
        />
        <Tabs.Screen
          name="studio-ai"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon Icon={Hash} focused={focused} />,
            tabBarAccessibilityLabel: t.common.tabs.studioAi,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon Icon={Send} focused={focused} />,
            tabBarAccessibilityLabel: t.common.tabs.messages,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />,
            tabBarAccessibilityLabel: t.common.tabs.profile,
          }}
        />
      </Tabs>
    </>
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

  return <AuthenticatedTabs />;
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
