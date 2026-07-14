import { Search } from 'lucide-react-native';
import React from 'react';
import { Input, XStack } from 'tamagui';

import { useTranslations } from '@/i18n';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  const t = useTranslations();

  return (
    <XStack
      backgroundColor="$surface"
      borderRadius="$md"
      paddingHorizontal="$3"
      alignItems="center"
      height={44}
      marginHorizontal="$4"
      marginBottom="$2"
    >
      <Search size={18} color="#A0A0A0" />
      <Input
        flex={1}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t.profileScreens.searchBar.placeholder}
        placeholderTextColor="#A0A0A0"
        backgroundColor="transparent"
        borderWidth={0}
        color="$color"
        fontSize={15}
        height="100%"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </XStack>
  );
}
