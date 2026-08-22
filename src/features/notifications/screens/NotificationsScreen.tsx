// Écran Notifications — E4-17.
// 5 tabs filtres + section « Demandes de suivis » prioritaire + groupes
// par période (Cette semaine / Ce mois / Plus ancien) + empty state par tab.
// mark_all_notifications_seen() appelé 1s après le mount.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView as RNScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';

import { FollowRequestCard } from '@/features/notifications/components/FollowRequestCard';
import { NotificationRow } from '@/features/notifications/components/NotificationRow';
import {
  useMarkAllNotificationsSeen,
  useMarkNotificationRead,
  useNotifications,
  type NotificationFilter,
  type NotificationItem,
} from '@/features/notifications/hooks/useNotifications';
import { useTranslations } from '@/i18n';

const logoSource = require('../../../../assets/Logo-Doumassi.webp') as number;

// Les libellés des filtres sont résolus via i18n dans FilterTabs (réactif).
const FILTER_IDS: NotificationFilter[] = ['all', 'unread', 'social', 'payment', 'ai'];

const DAY_MS = 24 * 60 * 60 * 1000;
const SEEN_DELAY_MS = 1000;

// Mock affiché en empty state sur l'onglet IA (cf. ticket : "toujours
// afficher au moins 1 notif mock pour la démo"). created_at épinglé 7 jours
// avant le chargement du module pour éviter la dérive cosmétique de l'âge
// affiché pendant la session ("à l'instant" → "1min" → "2min"…). Le titre est
// traduit et injecté à l'exécution (cf. `aiMock` dans le composant).
const AI_MOCK_ID = 'mock-ai-welcome';
const AI_MOCK_CREATED_AT = new Date(Date.now() - 7 * DAY_MS).toISOString();

function NotificationsHeader() {
  const t = useTranslations();
  return (
    <YStack backgroundColor="$background" paddingTop="$3" paddingBottom="$2">
      <XStack alignItems="center" justifyContent="center" paddingHorizontal="$4" height={42}>
        <Image source={logoSource} style={styles.logo} contentFit="contain" transition={200} />
      </XStack>
      <Text color="$color" fontSize={26} fontWeight="700" paddingHorizontal={20} marginTop="$2">
        {t.notifications.screen.title}
      </Text>
    </YStack>
  );
}

function FilterTabs({
  active,
  onChange,
}: {
  active: NotificationFilter;
  onChange: (filter: NotificationFilter) => void;
}) {
  const t = useTranslations();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterTabsContent}
    >
      {FILTER_IDS.map((id) => {
        const isActive = active === id;
        const label = t.notifications.filters[id];
        return (
          <YStack
            key={id}
            height={36}
            paddingHorizontal={14}
            borderRadius={18}
            backgroundColor={isActive ? '#FFFFFF' : '$surface'}
            alignItems="center"
            justifyContent="center"
            onPress={() => onChange(id)}
            pressStyle={{ scale: 0.97 }}
            accessibilityRole="button"
            accessibilityLabel={t.notifications.screen.filterA11y(label)}
          >
            <Text
              color={isActive ? '#000000' : '$textSecondary'}
              fontSize={14}
              fontWeight={isActive ? '700' : '500'}
            >
              {label}
            </Text>
          </YStack>
        );
      })}
    </ScrollView>
  );
}

function PeriodHeader({ label }: { label: string }) {
  return (
    <Text
      color="$textSecondary"
      fontSize={12}
      fontWeight="700"
      paddingHorizontal="$4"
      paddingTop="$4"
      paddingBottom="$2"
      style={styles.periodHeader}
    >
      {label}
    </Text>
  );
}

function EmptyState({ filter }: { filter: NotificationFilter }) {
  const t = useTranslations();
  const { title, subtitle } = useMemo(() => {
    const empty = t.notifications.empty;
    switch (filter) {
      case 'unread':
        return { title: empty.unreadTitle, subtitle: '' };
      case 'social':
        return { title: empty.socialTitle, subtitle: '' };
      case 'payment':
        return { title: empty.paymentTitle, subtitle: '' };
      case 'ai':
        // L'onglet IA injecte AI_MOCK quand il n'y a rien — cet empty
        // state ne devrait jamais être atteint, sauf si la mock est retirée.
        return { title: empty.aiTitle, subtitle: '' };
      default:
        return {
          title: empty.defaultTitle,
          subtitle: empty.defaultSubtitle,
        };
    }
  }, [filter, t]);
  return (
    <YStack alignItems="center" justifyContent="center" padding="$6" gap="$3" marginTop="$10">
      <Bell size={32} color="#A0A0A0" />
      <Text color="$color" fontSize={17} fontWeight="700" textAlign="center">
        {title}
      </Text>
      {subtitle ? (
        <Text color="$textSecondary" fontSize={14} textAlign="center" maxWidth={300}>
          {subtitle}
        </Text>
      ) : null}
    </YStack>
  );
}

function partitionByPeriod(notifs: NotificationItem[]) {
  const now = Date.now();
  const followRequests: NotificationItem[] = [];
  const week: NotificationItem[] = [];
  const month: NotificationItem[] = [];
  const older: NotificationItem[] = [];
  for (const n of notifs) {
    if (n.type === 'follow_request') {
      followRequests.push(n);
      continue;
    }
    const ageMs = now - new Date(n.created_at).getTime();
    if (ageMs < 7 * DAY_MS) week.push(n);
    else if (ageMs < 30 * DAY_MS) month.push(n);
    else older.push(n);
  }
  return { followRequests, week, month, older };
}

export function NotificationsScreen() {
  const t = useTranslations();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const query = useNotifications(filter);
  const markAllSeen = useMarkAllNotificationsSeen();
  const markRead = useMarkNotificationRead();
  const seenSentRef = useRef(false);

  // Marquage 'seen' au mount, après 1s — laisse à l'user le temps de voir
  // les dots rouges. Ne s'exécute qu'une fois par session de l'écran.
  useEffect(() => {
    if (seenSentRef.current) return;
    const timer = setTimeout(() => {
      seenSentRef.current = true;
      markAllSeen.mutate();
    }, SEEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [markAllSeen]);

  // Notif mock IA construite ici pour récupérer le titre traduit (réactif).
  // created_at reste épinglé au chargement du module (cf. AI_MOCK_CREATED_AT).
  const aiMock = useMemo<NotificationItem>(
    () => ({
      id: AI_MOCK_ID,
      recipient_id: '',
      actor_id: null,
      actor_username: null,
      actor_full_name: null,
      actor_avatar_url: null,
      actor_is_verified: false,
      type: 'system',
      entity_type: null,
      entity_id: null,
      payload: { title: t.notifications.mock.welcomeTitle },
      is_seen: true,
      is_read: true,
      created_at: AI_MOCK_CREATED_AT,
    }),
    [t]
  );

  // Tab IA : on injecte la mock en tête si la liste est vide ou ne contient
  // pas déjà au moins une notif système. `list` est memoizé pour stabiliser
  // sa référence (sinon le useMemo de partitionByPeriod invalide à chaque
  // render).
  const list = useMemo(() => {
    const raw = query.data ?? [];
    return filter === 'ai' && !raw.some((n) => n.type === 'system') ? [aiMock, ...raw] : raw;
  }, [filter, query.data, aiMock]);

  const { followRequests, week, month, older } = useMemo(() => partitionByPeriod(list), [list]);

  // useCallback : sinon `memo(NotificationRow)` est inefficace (nouvelle
  // référence d'`onPress` à chaque render du screen → toutes les rows
  // re-render).
  const handlePressNotif = useCallback(
    (notif: NotificationItem) => {
      // Marquer lu (optimistic) — ignoré pour la mock IA (id non-uuid).
      if (notif.id !== AI_MOCK_ID) markRead.mutate(notif.id);
      // Route selon le type.
      switch (notif.type) {
        case 'follow':
          if (notif.actor_id) router.push(`/profile/${notif.actor_id}`);
          return;
        case 'like':
        case 'comment':
        case 'mention':
          if (notif.entity_id) router.push(`/post/${notif.entity_id}`);
          return;
        case 'system':
        case 'payment':
          // Placeholder MVP — pas d'écran dédié encore.
          return;
        default:
          return;
      }
    },
    [markRead]
  );

  const isEmpty =
    !query.isLoading &&
    followRequests.length === 0 &&
    week.length === 0 &&
    month.length === 0 &&
    older.length === 0;

  const onScroll = (_e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Hook pour de futures interactions (scroll-to-top reset, etc.) — no-op MVP.
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RNScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor="#FFFFFF"
          />
        }
      >
        <NotificationsHeader />
        <FilterTabs active={filter} onChange={setFilter} />

        {query.isLoading ? (
          <YStack alignItems="center" paddingVertical="$8">
            <Spinner color="$color" size="large" />
          </YStack>
        ) : null}

        {isEmpty ? <EmptyState filter={filter} /> : null}

        {followRequests.length > 0 ? (
          <YStack marginTop="$3">
            <Text
              color="$color"
              fontSize={15}
              fontWeight="700"
              paddingHorizontal="$4"
              paddingBottom="$2"
            >
              {t.notifications.screen.followRequestsHeader(followRequests.length)}
            </Text>
            {followRequests.map((n) => (
              <FollowRequestCard key={n.id} notif={n} />
            ))}
          </YStack>
        ) : null}

        {week.length > 0 ? (
          <YStack>
            <PeriodHeader label={t.notifications.periods.week} />
            {week.map((n) => (
              <NotificationRow key={n.id} notif={n} onPress={handlePressNotif} />
            ))}
          </YStack>
        ) : null}

        {month.length > 0 ? (
          <YStack>
            <PeriodHeader label={t.notifications.periods.month} />
            {month.map((n) => (
              <NotificationRow key={n.id} notif={n} onPress={handlePressNotif} />
            ))}
          </YStack>
        ) : null}

        {older.length > 0 ? (
          <YStack>
            <PeriodHeader label={t.notifications.periods.older} />
            {older.map((n) => (
              <NotificationRow key={n.id} notif={n} onPress={handlePressNotif} />
            ))}
          </YStack>
        ) : null}
      </RNScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  flex1: { flex: 1, backgroundColor: '#000000' },
  scrollContent: {
    backgroundColor: '#000000',
    paddingBottom: 32,
  },
  logo: { width: 126, height: 30 },
  filterTabsContent: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  periodHeader: {
    letterSpacing: 0.5,
  },
});
