// ReportReasonSheet — E9-08 (#268)
//
// Bottom-sheet de choix de la raison de signalement. Cross-platform (Tamagui
// Sheet) — plus propre qu'un Alert à N boutons.

import { Flag } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Sheet, Text, XStack, YStack } from 'tamagui';

import { useTranslations } from '@/i18n';

import { REPORT_REASONS, type ReportReason } from '../hooks/useReportResource';

export interface ReportReasonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (reason: ReportReason) => void;
  disabled?: boolean;
}

export function ReportReasonSheet({
  open,
  onOpenChange,
  onSelect,
  disabled = false,
}: ReportReasonSheetProps) {
  const t = useTranslations();
  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[45]} dismissOnSnapToBottom>
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
        paddingHorizontal={20}
        paddingTop={16}
        paddingBottom={28}
      >
        <YStack gap={6}>
          <XStack alignItems="center" gap={8} marginBottom={8}>
            <Flag size={18} color="#FF6B6B" />
            <Text fontSize={17} fontWeight="800" color="$color">
              {t.cours.reportSheet.title}
            </Text>
          </XStack>
          <Text fontSize={13} color="$textSecondary" marginBottom={8}>
            {t.cours.reportSheet.subtitle}
          </Text>

          {REPORT_REASONS.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => {
                if (disabled) return;
                onSelect(reason);
              }}
              accessibilityRole="button"
              accessibilityLabel={t.cours.reportReason[reason]}
              style={styles.row}
            >
              <Text fontSize={15} color="$color">
                {t.cours.reportReason[reason]}
              </Text>
            </Pressable>
          ))}
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#262626',
  },
});
