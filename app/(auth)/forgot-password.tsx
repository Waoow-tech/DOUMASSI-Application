import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Input, Spinner, Text, XStack, YStack } from 'tamagui';

import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/features/auth/schemas/passwordResetSchema';
import { supabase } from '@/lib/supabase';
export default function ForgotPasswordScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: 'doumassi://reset-password',
    });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    setMessage('Un email de réinitialisation vous a été envoyé.');
    setIsLoading(false);
  };

  return (
    <YStack flex={1} backgroundColor="$background" padding="$5" justifyContent="center" gap="$5">
      <Text fontSize={44} fontWeight="900" color="$color">
        Doumassi
      </Text>

      <YStack gap="$2">
        <Text fontSize={32} fontWeight="800" color="$color">
          Forgot your password?
        </Text>

        <Text fontSize={16} color="$placeholderColor" lineHeight={24}>
          No worries! Enter your email address and we’ll send you instructions to reset your
          password.
        </Text>
      </YStack>

      <YStack gap="$2">
        <Controller
          control={form.control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <XStack
              alignItems="center"
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius="$4"
              height={56}
              paddingHorizontal="$3"
              gap="$3"
            >
              <Mail size={20} color="#FF006E" />
              <Input
                flex={1}
                borderWidth={0}
                backgroundColor="transparent"
                placeholder="Email"
                placeholderTextColor="$placeholderColor"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                color="$color"
              />
            </XStack>
          )}
        />

        {form.formState.errors.email?.message ? (
          <Text fontSize={12} color="$danger">
            {form.formState.errors.email.message}
          </Text>
        ) : null}
      </YStack>

      {message ? (
        <Text fontSize={14} color="$color" textAlign="center">
          {message}
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
        {isLoading ? <Spinner size="small" color="$background" /> : 'Send reset link'}
      </Button>

      <Button backgroundColor="transparent" color="$color" onPress={() => router.back()}>
        Back to login
      </Button>
    </YStack>
  );
}
