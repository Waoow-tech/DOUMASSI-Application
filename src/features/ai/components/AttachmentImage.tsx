// Affichage d'une image jointe au chat IA — E5-06.
//
// Le bucket ai-attachments est PRIVÉ : pas d'URL publique. Pour afficher une
// image persistée, on signe son path à la demande (URL courte durée). Pour une
// image encore locale (tour optimiste), on l'affiche directement.

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { YStack } from 'tamagui';

import type { MessageImage } from '@/features/ai/lib/mergeMessages';
import { signAiAttachment } from '@/lib/storage';

const SIZE = 180;

export function AttachmentImage({ image }: { image: MessageImage }) {
  // URI locale (optimiste) → affichage direct, pas de signature.
  const [uri, setUri] = useState<string | null>(image.localUri ?? null);

  useEffect(() => {
    if (image.localUri || !image.path) return;
    let cancelled = false;
    void signAiAttachment(image.path).then((signed) => {
      if (!cancelled) setUri(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [image.localUri, image.path]);

  if (!uri) {
    // Placeholder pendant la signature (ou si elle échoue).
    return <YStack style={styles.image} backgroundColor="$surfaceElevated" />;
  }

  return <Image source={{ uri }} style={styles.image} contentFit="cover" transition={150} />;
}

const styles = StyleSheet.create({
  image: {
    width: SIZE,
    height: SIZE,
    borderRadius: 12,
  },
});
