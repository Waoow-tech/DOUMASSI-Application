// ResourceFilePicker — E9-06 (#266)
//
// Sélection des fichiers d'une ressource : PDF (via expo-document-picker) ou
// images (via le même document-picker, qui gère aussi les images). Limite à
// MAX_FILES. L'upload réel se fait au submit (cf app/cours/create.tsx).
//
// On garde le nom + le mimeType de chaque fichier (nécessaires à
// uploadResourceFile pour choisir le pipeline PDF vs image).

import * as DocumentPicker from 'expo-document-picker';
import { FileText, ImageIcon, Plus, X } from 'lucide-react-native';
import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';

export interface PickedFile {
  uri: string;
  name: string | null;
  mimeType: string | null;
}

export interface ResourceFilePickerProps {
  files: PickedFile[];
  onChange: (next: PickedFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const DEFAULT_MAX = 5;

export function ResourceFilePicker({
  files,
  onChange,
  maxFiles = DEFAULT_MAX,
  disabled = false,
}: ResourceFilePickerProps) {
  const canAdd = files.length < maxFiles && !disabled;

  const handleAdd = useCallback(async () => {
    if (!canAdd) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const picked: PickedFile[] = result.assets
        .slice(0, maxFiles - files.length)
        .map((a) => ({ uri: a.uri, name: a.name ?? null, mimeType: a.mimeType ?? null }));
      onChange([...files, ...picked]);
    } catch {
      Alert.alert('Sélection impossible', 'Impossible d’ouvrir le sélecteur de fichiers.');
    }
  }, [canAdd, files, maxFiles, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(files.filter((_, i) => i !== index));
    },
    [files, onChange]
  );

  return (
    <YStack gap={8}>
      {files.map((f, i) => {
        const isImage =
          (f.mimeType ?? '').startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name ?? '');
        const Icon = isImage ? ImageIcon : FileText;
        return (
          <XStack
            key={`${f.uri}-${i}`}
            alignItems="center"
            gap={12}
            backgroundColor="$surface"
            borderRadius={10}
            padding={10}
          >
            <View
              width={36}
              height={36}
              borderRadius={8}
              backgroundColor="$surfaceElevated"
              alignItems="center"
              justifyContent="center"
            >
              <Icon size={18} color="#10D970" strokeWidth={2} />
            </View>
            <Text flex={1} fontSize={13} color="$color" numberOfLines={1}>
              {f.name ?? `Fichier ${i + 1}`}
            </Text>
            <Pressable
              onPress={() => handleRemove(i)}
              disabled={disabled}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${f.name ?? `le fichier ${i + 1}`}`}
            >
              <X size={16} color="#A0A0A0" />
            </Pressable>
          </XStack>
        );
      })}

      {canAdd ? (
        <Pressable
          onPress={() => void handleAdd()}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter un fichier (${files.length}/${maxFiles})`}
          style={styles.addRow}
        >
          <XStack alignItems="center" justifyContent="center" gap={8}>
            <Plus size={18} color="#FFFFFF" strokeWidth={2} />
            <Text fontSize={13} fontWeight="600" color="#FFFFFF">
              Ajouter un PDF ou une image ({files.length}/{maxFiles})
            </Text>
          </XStack>
        </Pressable>
      ) : null}
    </YStack>
  );
}

const styles = StyleSheet.create({
  addRow: {
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
  },
});
