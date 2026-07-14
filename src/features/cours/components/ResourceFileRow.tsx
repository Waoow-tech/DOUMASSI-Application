// ResourceFileRow — E9-05 — Ligne de fichier téléchargeable/ouvrable
//
// Une ressource peut embarquer plusieurs fichiers (PDF, images). On les
// ouvre via le navigateur in-app (WebBrowser) — suffisant pour lire un PDF
// ou voir une image. Le téléchargement "dur" (save to disk) sera un +
// ultérieur si besoin.

import { FileText, ImageIcon, ExternalLink } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View, XStack } from 'tamagui';

import { useTranslations } from '@/i18n';

function fileName(url: string, fallback: string): string {
  try {
    const path = decodeURIComponent(url.split('?')[0] ?? url);
    const last = path.split('/').pop() ?? fallback;
    // Les uploads sont nommés <uuid>.<ext> → on affiche juste l'extension en
    // majuscule + un index lisible côté écran (le nom uuid n'apporte rien).
    return last;
  } catch {
    return fallback;
  }
}

function isImage(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(url.split('?')[0] ?? '');
}

function extLabel(url: string, fallback: string): string {
  const m = (url.split('?')[0] ?? '').match(/\.([a-z0-9]+)$/i);
  return m ? m[1]!.toUpperCase() : fallback;
}

export interface ResourceFileRowProps {
  url: string;
  index: number;
  onOpen: (url: string) => void;
}

export function ResourceFileRow({ url, index, onOpen }: ResourceFileRowProps) {
  const t = useTranslations();
  const image = isImage(url);
  const Icon = image ? ImageIcon : FileText;
  const kind = image ? t.cours.file.image : t.cours.file.document;
  const label = t.cours.file.item(kind, index + 1);
  const ext = extLabel(url, t.cours.file.defaultExt);

  return (
    <Pressable
      onPress={() => onOpen(url)}
      accessibilityRole="button"
      accessibilityLabel={t.cours.file.openA11y(label, ext)}
      style={styles.row}
    >
      <XStack
        alignItems="center"
        gap={12}
        backgroundColor="$surface"
        borderRadius={10}
        padding={12}
      >
        <View
          width={40}
          height={40}
          borderRadius={8}
          backgroundColor="$surfaceElevated"
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={20} color="#10D970" strokeWidth={2} />
        </View>
        <View flex={1} minWidth={0}>
          <Text fontSize={14} fontWeight="600" color="$color" numberOfLines={1}>
            {label}
          </Text>
          <Text fontSize={11} color="$textSecondary" numberOfLines={1}>
            {ext} · {fileName(url, t.cours.file.defaultName)}
          </Text>
        </View>
        <ExternalLink size={16} color="#A0A0A0" />
      </XStack>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
  },
});
