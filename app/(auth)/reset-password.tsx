import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Input, Spinner, Text, XStack, YStack } from 'tamagui';

import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/features/auth/schemas/passwordResetSchema';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setIsLoading(true);
    setResetError(null);

    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setResetError(error.message);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    router.replace('/(auth)/login');
  };

  return (
    <YStack flex={1} backgroundColor="$background" padding="$5" justifyContent="center" gap="$5">
      <YStack gap="$2">
        <Text fontSize={32} fontWeight="800" color="$color">
          Nouveau mot de passe
        </Text>

        <Text fontSize={16} color="$placeholderColor" lineHeight={24}>
          Entrez votre nouveau mot de passe pour finaliser la réinitialisation.
        </Text>
      </YStack>

      <YStack gap="$3">
        <Controller
          control={form.control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <XStack
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius="$4"
              alignItems="center"
              height={48}
            >
              <Input
                placeholder="Nouveau mot de passe"
                placeholderTextColor="$placeholderColor"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                borderWidth={0}
                backgroundColor="transparent"
                color="$color"
                flex={1}
                paddingHorizontal="$3"
              />

              <YStack paddingRight="$3" onPress={() => setShowPassword((prev) => !prev)}>
                {showPassword ? (
                  <EyeOff size={20} color="#A0A0A0" />
                ) : (
                  <Eye size={20} color="#A0A0A0" />
                )}
              </YStack>
            </XStack>
          )}
        />

        {form.formState.errors.password?.message ? (
          <Text fontSize={12} color="$danger">
            {form.formState.errors.password.message}
          </Text>
        ) : null}

        <Controller
          control={form.control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              placeholder="Confirmer le mot de passe"
              placeholderTextColor="$placeholderColor"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry={!showPassword}
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius="$4"
              backgroundColor="transparent"
              color="$color"
              height={48}
              paddingHorizontal="$3"
            />
          )}
        />

        {form.formState.errors.confirmPassword?.message ? (
          <Text fontSize={12} color="$danger">
            {form.formState.errors.confirmPassword.message}
          </Text>
        ) : null}
      </YStack>

      {resetError ? (
        <Text fontSize={13} color="$danger" textAlign="center">
          {resetError}
        </Text>
      ) : null}

      <Button
        onPress={form.handleSubmit(onSubmit)}
        disabled={isLoading}
        height={48}
        borderRadius="$4"
        backgroundColor="$color"
        color="$background"
        fontWeight="700"
      >
        {isLoading ? <Spinner size="small" color="$background" /> : 'Modifier le mot de passe'}
      </Button>
    </YStack>
  );
}
