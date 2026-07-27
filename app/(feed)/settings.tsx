// Ecran Paramètres v2 - Sprint 2 Profils & Social.
// Ecran unique scrollable pour la démo MVP du 5 juin 2026.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Handshake,
  FileText,
  Info,
  KeyRound,
  Languages,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  User,
  Wallet,
} from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { Button, ScrollView, Sheet, Spinner, Switch, Text, XStack, YStack } from 'tamagui';

import { useExportMyData } from '@/features/auth/hooks/useExportMyData';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useBlockedUsers } from '@/features/profile/hooks/useBlockedUsers';
import {
  type ProfileData,
  profileQueryKey,
  useCurrentProfile,
} from '@/features/profile/hooks/useProfile';
import { getT, useTranslations } from '@/i18n';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useLanguageStore } from '@/stores/languageStore';

const logoSource = require('../../assets/Logo-Doumassi.webp') as number;

const COLORS = {
  background: '#000000',
  surface: '#1A1A1A',
  surfaceElevated: '#252525',
  border: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  accentNeon: '#10D970',
  danger: '#FF3B30',
  placeholder: '#6B6B6B',
};

type SettingsIcon = React.ComponentType<{ size?: number; color?: string }>;

function soonAlert() {
  const t = getT();
  Alert.alert(t.profileScreens.settings.soonTitle, t.profileScreens.settings.soonMessage);
}

function getInitials(name: string, email: string | null) {
  const value = name.trim() || email?.split('@')[0] || 'User';
  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    const [first = '', second = ''] = parts;
    return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}

function usePrivacyToggle() {
  const queryClient = useQueryClient();
  const t = useTranslations();

  return useMutation({
    mutationFn: async ({ profileId, isPrivate }: { profileId: string; isPrivate: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_private: isPrivate, updated_at: new Date().toISOString() })
        .eq('id', profileId);

      if (error) throw error;
    },
    onMutate: async ({ isPrivate }) => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previousProfile = queryClient.getQueryData<ProfileData>(profileQueryKey);

      queryClient.setQueryData<ProfileData>(profileQueryKey, (old) =>
        old ? { ...old, is_private: isPrivate } : old
      );

      return { previousProfile };
    },
    onError: (err, _variables, context) => {
      logger.warn('Privacy toggle failed, rolling back', { message: (err as Error).message });

      if (context?.previousProfile) {
        queryClient.setQueryData(profileQueryKey, context.previousProfile);
      }

      Alert.alert(
        t.profileScreens.settings.privacyErrorTitle,
        t.profileScreens.settings.privacyErrorMessage
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack gap="$2">
      <Text
        fontSize={12}
        color="$textSecondary"
        fontWeight="600"
        paddingHorizontal="$1"
        textTransform="uppercase"
      >
        {title}
      </Text>
      <YStack backgroundColor="$surface" borderRadius="$lg" overflow="hidden">
        {children}
      </YStack>
    </YStack>
  );
}

function Badge({ children, isCount = false }: { children: ReactNode; isCount?: boolean }) {
  return (
    <YStack
      backgroundColor="$borderColor"
      borderRadius={10}
      paddingHorizontal={isCount ? 9 : 8}
      paddingVertical={2}
      minWidth={isCount ? 24 : undefined}
      alignItems="center"
    >
      <Text fontSize={isCount ? 12 : 10} color="$textSecondary" fontWeight="600">
        {children}
      </Text>
    </YStack>
  );
}

function SettingRow({
  icon: Icon,
  label,
  onPress,
  trailing,
  destructive = false,
  showChevron = true,
  isLast = false,
}: {
  icon: SettingsIcon;
  label: string;
  onPress?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
  showChevron?: boolean;
  isLast?: boolean;
}) {
  const color = destructive ? COLORS.danger : COLORS.text;

  return (
    <XStack
      minHeight={56}
      alignItems="center"
      paddingVertical={14}
      paddingHorizontal={16}
      gap={12}
      borderBottomWidth={isLast ? 0 : 0.5}
      borderBottomColor="$borderColor"
      onPress={onPress}
      pressStyle={onPress ? { opacity: 0.72 } : undefined}
      cursor={onPress ? 'pointer' : undefined}
    >
      <Icon size={22} color={color} />
      <Text flex={1} color={color} fontSize={15} fontWeight={destructive ? '700' : '500'}>
        {label}
      </Text>
      {trailing}
      {showChevron ? <ChevronRight size={18} color={COLORS.placeholder} /> : null}
    </XStack>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  disabled = false,
  onCheckedChange,
  isLast = false,
}: {
  icon: SettingsIcon;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <SettingRow
      icon={icon}
      label={label}
      isLast={isLast}
      showChevron={false}
      trailing={
        <Switch
          size="$3"
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          backgroundColor={checked ? '$accentNeon' : '$surfaceElevated'}
          borderWidth={0}
          opacity={disabled ? 0.65 : 1}
        >
          <Switch.Thumb animation="quick" backgroundColor="white" />
        </Switch>
      }
    />
  );
}

function ProfileCard({ profile }: { profile: ProfileData }) {
  const t = useTranslations();
  const displayName =
    profile.full_name?.trim() ||
    profile.username ||
    t.profileScreens.settings.profileCardUserFallback;
  const initials = getInitials(displayName, profile.email);

  return (
    <XStack
      backgroundColor="$surface"
      borderRadius="$lg"
      padding={16}
      gap={14}
      alignItems="center"
      onPress={() => router.push('/profile')}
      pressStyle={{ opacity: 0.78 }}
      cursor="pointer"
    >
      <YStack
        width={64}
        height={64}
        borderRadius={32}
        borderWidth={2}
        borderColor="$accentNeon"
        alignItems="center"
        justifyContent="center"
        position="relative"
        overflow="visible"
        backgroundColor="$surfaceElevated"
      >
        {profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={{ width: 58, height: 58, borderRadius: 29 }}
            contentFit="cover"
          />
        ) : (
          <Text color="$color" fontSize={18} fontWeight="700">
            {initials}
          </Text>
        )}
        <YStack
          position="absolute"
          right={0}
          bottom={1}
          width={12}
          height={12}
          borderRadius={6}
          backgroundColor="$accentNeon"
          borderWidth={2}
          borderColor="$background"
        />
      </YStack>

      <YStack flex={1} gap={3}>
        <Text color="$color" fontSize={18} fontWeight="700" numberOfLines={1}>
          {displayName}
        </Text>
        <Text color="$textSecondary" fontSize={13} numberOfLines={1}>
          {profile.email ?? t.profileScreens.settings.profileCardNoEmail}
        </Text>
      </YStack>

      <ChevronRight size={18} color={COLORS.placeholder} />
    </XStack>
  );
}

export default function SettingsScreen() {
  const { logout, isLoading: logoutLoading } = useLogout();
  const profileQuery = useCurrentProfile();
  const blockedUsersQuery = useBlockedUsers();
  const privacyToggle = usePrivacyToggle();
  const exportMyData = useExportMyData();
  const t = useTranslations();
  const copy = t.auth.settings;
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const handleExportData = async () => {
    try {
      const result = await exportMyData.mutateAsync();
      logger.info('Settings export OK', {
        sizeBytes: result.sizeBytes,
        truncated: result.truncated,
      });
      // Pas d'Alert de succès : le sheet de partage natif a déjà été présenté.
      // Si l'export est tronqué (volume > 10 MB, rarissime en bêta), on alerte.
      if (result.truncated) {
        Alert.alert(
          t.profileScreens.settings.exportPartialTitle,
          t.profileScreens.settings.exportPartialMessage
        );
      }
    } catch (err) {
      Alert.alert(
        t.profileScreens.settings.exportFailedTitle,
        err instanceof Error ? err.message : t.profileScreens.settings.exportFailedMessage
      );
    }
  };

  // MOCK - sera cable au sprint Notifications.
  const [pushNotifications, setPushNotifications] = useState(true);
  // MOCK - sera cable au sprint Notifications.
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const profile = profileQuery.data;
  const blockedUsersCount = blockedUsersQuery.data?.length ?? 0;

  // `href` défini => la feature est livrée : on navigue (pas de badge « Bientôt »).
  const doumassiFeatures = useMemo(
    () => [
      { icon: Wallet, label: t.profileScreens.settings.featureWallet, href: '/wallet' as const },
      {
        icon: Handshake,
        label: t.profileScreens.settings.featureMatching,
        href: '/matching' as const,
      },
      { icon: Sparkles, label: t.profileScreens.settings.featureAi, href: '/studio-ai' as const },
      { icon: Store, label: t.profileScreens.settings.featureMarketplace, href: null },
      { icon: MessageSquare, label: t.profileScreens.settings.featureMessaging, href: null },
      { icon: Phone, label: t.profileScreens.settings.featureCalls, href: null },
    ],
    [t]
  );

  const confirmLogout = () => {
    Alert.alert(copy.logoutConfirmTitle, copy.logoutConfirmMessage, [
      { text: copy.logoutConfirmCancel, style: 'cancel' },
      {
        text: copy.logoutConfirmAction,
        style: 'destructive',
        onPress: () => void logout(),
      },
    ]);
  };

  const handlePrivacyChange = (isPrivate: boolean) => {
    if (!profile) return;
    privacyToggle.mutate({ profileId: profile.id, isPrivate });
  };

  const openSupportEmail = () => {
    void Linking.openURL('mailto:contact@doumassi.com?subject=DOUMASSI%20Support');
  };

  if (profileQuery.isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
        <Spinner size="large" color="$color" />
      </YStack>
    );
  }

  if (!profile) {
    return (
      <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
        <Text color="$textSecondary">{t.profileScreens.settings.profileUnavailable}</Text>
      </YStack>
    );
  }

  return (
    <>
      <ScrollView
        flex={1}
        backgroundColor="$background"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Platform.OS === 'ios' ? 60 : 44,
          paddingBottom: 44,
        }}
      >
        <YStack paddingHorizontal={20} gap={20}>
          <XStack alignItems="center" justifyContent="center" height={38} position="relative">
            <YStack
              position="absolute"
              left={-4}
              onPress={() => router.back()}
              pressStyle={{ opacity: 0.6 }}
              cursor="pointer"
              padding="$1"
              accessibilityRole="button"
              accessibilityLabel={t.profileScreens.settings.backAccessibilityLabel}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ChevronLeft size={24} color="#FFFFFF" />
            </YStack>
            <Image source={logoSource} style={{ width: 34, height: 34 }} contentFit="contain" />
          </XStack>

          <Text color="$color" fontSize={26} fontWeight="700" fontFamily="$heading">
            {t.profileScreens.settings.title}
          </Text>

          <ProfileCard profile={profile} />

          <Section title={t.profileScreens.settings.sectionPrivacy}>
            <ToggleRow
              icon={Lock}
              label={t.profileScreens.settings.privateProfile}
              checked={Boolean(profile.is_private)}
              disabled={privacyToggle.isPending}
              onCheckedChange={handlePrivacyChange}
            />
            <SettingRow
              icon={EyeOff}
              label={t.profileScreens.settings.hiddenPosts}
              onPress={() => router.push('/settings/hidden-posts')}
              isLast
            />
          </Section>

          <Section title={t.profileScreens.settings.sectionNotifications}>
            <ToggleRow
              icon={Bell}
              label={t.profileScreens.settings.pushNotifications}
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
            />
            <ToggleRow
              icon={Mail}
              label={t.profileScreens.settings.emailNotifications}
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
              isLast
            />
          </Section>

          <Section title={t.settings.languageTitle}>
            <SettingRow
              icon={Languages}
              label={t.settings.languageFr}
              showChevron={false}
              trailing={language === 'fr' ? <Check size={20} color={COLORS.accentNeon} /> : null}
              onPress={() => setLanguage('fr')}
            />
            <SettingRow
              icon={Languages}
              label={t.settings.languageEn}
              showChevron={false}
              trailing={language === 'en' ? <Check size={20} color={COLORS.accentNeon} /> : null}
              onPress={() => setLanguage('en')}
              isLast
            />
          </Section>

          <Section title={t.profileScreens.settings.sectionAccount}>
            <SettingRow
              icon={User}
              label={t.profileScreens.settings.editProfile}
              onPress={() => router.push('/profile/edit')}
            />
            <SettingRow
              icon={KeyRound}
              label={t.profileScreens.settings.changePassword}
              onPress={() => router.push('/(feed)/settings/change-password')}
            />
            <SettingRow
              icon={Download}
              label={t.profileScreens.settings.exportData}
              trailing={exportMyData.isPending ? <Spinner color="$accentNeon" /> : null}
              onPress={() => {
                if (!exportMyData.isPending) void handleExportData();
              }}
            />
            <SettingRow
              icon={Trash2}
              label={t.profileScreens.settings.deleteAccount}
              destructive
              onPress={() => router.push('/(feed)/settings/delete-account')}
              isLast
            />
          </Section>

          <Section title={t.profileScreens.settings.sectionFeatures}>
            {doumassiFeatures.map((item, index) => (
              <SettingRow
                key={item.label}
                icon={item.icon}
                label={item.label}
                trailing={item.href ? null : <Badge>{t.profileScreens.settings.badgeSoon}</Badge>}
                onPress={item.href ? () => router.push(item.href) : soonAlert}
                isLast={index === doumassiFeatures.length - 1}
              />
            ))}
          </Section>

          <Section title={t.profileScreens.settings.sectionModeration}>
            <SettingRow
              icon={Shield}
              label={t.profileScreens.settings.blockedUsers}
              trailing={blockedUsersCount > 0 ? <Badge isCount>{blockedUsersCount}</Badge> : null}
              onPress={() => router.push('/settings/blocked')}
              isLast
            />
          </Section>

          <Section title={t.profileScreens.settings.sectionLegal}>
            <SettingRow
              icon={FileText}
              label={t.profileScreens.settings.terms}
              onPress={() => router.push('/terms')}
            />
            <SettingRow
              icon={ShieldCheck}
              label={t.profileScreens.settings.privacyPolicy}
              onPress={() => router.push('/privacy')}
              isLast
            />
          </Section>

          <Section title={t.profileScreens.settings.sectionHelp}>
            <SettingRow
              icon={MessageCircle}
              label={t.profileScreens.settings.contactUs}
              onPress={openSupportEmail}
            />
            <SettingRow
              icon={Info}
              label={t.profileScreens.settings.about}
              onPress={() => setAboutOpen(true)}
              isLast
            />
          </Section>

          <Button
            id="settings-logout-button"
            onPress={confirmLogout}
            disabled={logoutLoading}
            backgroundColor="transparent"
            color="$danger"
            borderWidth={0}
            height={48}
            fontWeight="700"
            fontSize={15}
            icon={logoutLoading ? undefined : <LogOut size={18} color={COLORS.danger} />}
            pressStyle={{ opacity: 0.85, scale: 0.98 }}
          >
            {logoutLoading ? <Spinner size="small" color="$danger" /> : copy.logoutButton}
          </Button>

          <Text
            textAlign="center"
            color="$borderColor"
            fontSize={10}
            letterSpacing={1.2}
            marginTop={2}
            textTransform="uppercase"
          >
            DOUMASSI · v1.0.0-beta
          </Text>
        </YStack>
      </ScrollView>

      <Sheet
        modal
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        snapPoints={[38]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay backgroundColor="rgba(0,0,0,0.72)" />
        <Sheet.Frame
          backgroundColor="$surface"
          borderTopLeftRadius="$lg"
          borderTopRightRadius="$lg"
          padding="$5"
          gap="$4"
          alignItems="center"
        >
          <Sheet.Handle backgroundColor="$borderColor" />
          <Image source={logoSource} style={{ width: 72, height: 72 }} contentFit="contain" />
          <YStack alignItems="center" gap="$2">
            <Text color="$color" fontSize={18} fontWeight="700">
              DOUMASSI
            </Text>
            <Text color="$textSecondary" fontSize={14} textAlign="center">
              {t.profileScreens.settings.aboutVersion}
            </Text>
            <Text color="$placeholderColor" fontSize={12} textAlign="center" marginTop="$2">
              {t.profileScreens.settings.aboutRights}
            </Text>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}
