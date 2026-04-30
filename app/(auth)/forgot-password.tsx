import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Input, Spinner, Text, YStack } from 'tamagui';

import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/features/auth/schemas/passwordResetSchema';
import { supabase } from '@/lib/supabase';

const logoSource = require('../../assets/Logo-Doumassi.png') as number;

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
    <YStack flex={1} backgroundColor="$background" padding="$5" alignItems="center">
      <YStack alignItems="center" marginTop="$4" marginBottom="$8">
        <Image
          source={logoSource}
          style={{ width: 72, height: 72 }}
          contentFit="contain"
          accessibilityLabel="Logo DOUMASSI"
        />
      </YStack>

      <YStack
        width="100%"
        maxWidth={380}
        borderWidth={1}
        borderColor="$color"
        borderRadius="$8"
        padding="$6"
        gap="$4"
        alignItems="center"
      >
        <Text fontSize={28} fontWeight="800" color="$color" textAlign="center" lineHeight={34}>
          Forgot your{'\n'}password?
        </Text>

        <Text fontSize={15} color="$placeholderColor" lineHeight={21} textAlign="center">
          No worries! Enter your email address and we’ll send you instructions to reset your
          password.
        </Text>

        <YStack width="100%" gap="$2">
          <Controller
            control={form.control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                height={52}
                borderWidth={1}
                borderColor="$borderColor"
                borderRadius="$4"
                backgroundColor="transparent"
                placeholder="Email address"
                placeholderTextColor="$placeholderColor"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                color="$color"
                paddingHorizontal="$4"
              />
            )}
          />

          {form.formState.errors.email?.message ? (
            <Text fontSize={12} color="$danger">
              {form.formState.errors.email.message}
            </Text>
          ) : null}
        </YStack>

        {message ? (
          <Text fontSize={13} color="$color" textAlign="center">
            {message}
          </Text>
        ) : null}

        <Button
          width="100%"
          onPress={form.handleSubmit(onSubmit)}
          disabled={isLoading}
          height={50}
          borderRadius="$4"
          backgroundColor="$color"
          color="$background"
          fontWeight="800"
          marginTop="$1"
        >
          {isLoading ? <Spinner size="small" color="$background" /> : 'Send Reset Instructions'}
        </Button>

        <Button
          backgroundColor="transparent"
          color="$color"
          fontWeight="700"
          onPress={() => router.replace('/login')}
        >
          Back to Login
        </Button>
      </YStack>
    </YStack>
  );
}
