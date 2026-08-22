// ProfileReportSheet — Sécu B2.
//
// Bottom-sheet de choix du motif de signalement d'un profil.
// Modelé sur MatchingReportSheet (E13-07) — motifs propres à un profil.

import { Flag } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Sheet, Text, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

import { PROFILE_REPORT_REASONS, type ProfileReportReason } from '../hooks/useReportProfile';

export interface ProfileReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (reason: ProfileReportReason) => void;
  disabled?: boolean;
}

export function ProfileReportSheet({
  open,
  onOpenChange,
  onSelect,
  disabled = false,
}: ProfileReportSheetProps) {
  const t = useTranslations();

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[50]} dismissOnSnapToBottom>
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
        padding={20}
        gap={4}
      >
        <XStack alignItems="center" gap={10} paddingBottom={8}>
          <Flag size={20} color="#FF3B30" />
          <Text fontSize={17} fontWeight="800" color="$color">
            {t.profileScreens.otherProfile.reportSheet.title}
          </Text>
        </XStack>

        {PROFILE_REPORT_REASONS.map((reason) => (
          <Pressable
            key={reason}
            disabled={disabled}
            onPress={() => onSelect(reason)}
            accessibilityRole="button"
            accessibilityLabel={t.profileScreens.otherProfile.reportSheet.reasons[reason]}
            style={({ pressed }) => ({ opacity: pressed || disabled ? 0.6 : 1 })}
          >
            <YStack
              paddingVertical={14}
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderBottomColor="$borderColor"
            >
              <Text fontSize={15} color="$color">
                {t.profileScreens.otherProfile.reportSheet.reasons[reason]}
              </Text>
            </YStack>
          </Pressable>
        ))}
      </Sheet.Frame>
    </Sheet>
  );
}
