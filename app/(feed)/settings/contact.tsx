// Écran « Nous contacter » — E8-03.
// Formulaire 5 champs (nom, e-mail, téléphone, entreprise, sujet, message) →
// Edge Function send-contact (Resend). Toast succès + reset au succès, erreur
// inline sinon. Structure calquée sur change-password.tsx (header + ScrollView
// + Controller + toast local auto-masqué).

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { Button, Input, ScrollView, Spinner, Text, TextArea, XStack, YStack } from 'tamagui';

import { useSendContact } from '@/features/contact/hooks/useSendContact';
import {
  createContactSchema,
  type ContactFormValues,
} from '@/features/contact/schemas/contactSchema';
import { useTranslations } from '@/i18n';

function Field({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  keyboardType,
  autoCapitalize = 'sentences',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
  placeholder: string;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
  multiline?: boolean;
}) {
  const InputComponent = multiline ? TextArea : Input;
  return (
    <YStack gap="$1.5">
      <Text color="$textSecondary" fontSize={13} fontWeight="700">
        {label}
      </Text>
      <InputComponent
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="$placeholderColor"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        borderWidth={1}
        borderColor={error ? '$danger' : '$borderColor'}
        borderRadius="$4"
        backgroundColor="$surface"
        color="$color"
        fontSize={15}
        paddingHorizontal="$3"
        {...(multiline
          ? { minHeight: 120, paddingVertical: '$3', verticalAlign: 'top' as const }
          : { height: 48 })}
      />
      {error ? (
        <Text color="$danger" fontSize={12} paddingLeft="$1">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}

export default function ContactScreen() {
  const t = useTranslations();
  const c = t.contact;
  const sendContact = useSendContact();
  const [successVisible, setSuccessVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => createContactSchema(c.validation), [c]);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', company: '', subject: '', message: '' },
    mode: 'onBlur',
  });

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  }, []);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    sendContact.mutate(values, {
      onSuccess: () => {
        form.reset();
        setSuccessVisible(true);
        setTimeout(() => setSuccessVisible(false), 3000);
      },
      onError: (err) => {
        const code = (err as Error).message;
        setFormError(code === 'rate_limited' ? c.errors.rateLimited : c.errors.failed);
      },
    });
  });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <YStack flex={1} backgroundColor="$background">
        <XStack
          height={56}
          paddingHorizontal="$4"
          alignItems="center"
          marginTop={Platform.OS === 'ios' ? '$6' : '$4'}
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderColor"
        >
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text
            flex={1}
            marginLeft="$3"
            color="$color"
            fontSize={20}
            fontWeight="700"
            fontFamily="$heading"
          >
            {c.title}
          </Text>
        </XStack>

        <ScrollView
          flex={1}
          backgroundColor="$background"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <YStack width="100%" maxWidth={430} alignSelf="center" gap="$4">
            <Text color="$textSecondary" fontSize={14}>
              {c.subtitle}
            </Text>

            <Controller
              control={form.control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={c.nameLabel}
                  placeholder={c.namePlaceholder}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={form.formState.errors.name?.message}
                />
              )}
            />

            <Controller
              control={form.control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={c.emailLabel}
                  placeholder={c.emailPlaceholder}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={form.formState.errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
            />

            <Controller
              control={form.control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={c.phoneLabel}
                  placeholder={c.phonePlaceholder}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={form.formState.errors.phone?.message}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              )}
            />

            <Controller
              control={form.control}
              name="company"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={c.companyLabel}
                  placeholder={c.companyPlaceholder}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={form.formState.errors.company?.message}
                />
              )}
            />

            <Controller
              control={form.control}
              name="subject"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={c.subjectLabel}
                  placeholder={c.subjectPlaceholder}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={form.formState.errors.subject?.message}
                />
              )}
            />

            <Controller
              control={form.control}
              name="message"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label={c.messageLabel}
                  placeholder={c.messagePlaceholder}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={form.formState.errors.message?.message}
                  multiline
                />
              )}
            />

            {formError ? (
              <Text color="$danger" fontSize={13} textAlign="center">
                {formError}
              </Text>
            ) : null}

            <Button
              onPress={onSubmit}
              disabled={sendContact.isPending}
              backgroundColor="$color"
              color="$background"
              borderRadius="$4"
              height={50}
              fontWeight="800"
              fontSize={16}
              opacity={sendContact.isPending ? 0.6 : 1}
              pressStyle={{ opacity: 0.85, scale: 0.98 }}
              marginTop="$2"
            >
              {sendContact.isPending ? <Spinner color="$background" /> : c.submit}
            </Button>
          </YStack>
        </ScrollView>

        {/* Toast succès (local, auto-masqué) — calqué sur change-password.tsx */}
        {successVisible ? (
          <YStack
            position="absolute"
            bottom={96}
            alignSelf="center"
            backgroundColor="$surfaceElevated"
            borderWidth={1}
            borderColor="$borderColor"
            borderRadius="$4"
            paddingHorizontal="$4"
            paddingVertical="$2"
          >
            <Text color="$color" fontSize={13} fontWeight="700">
              {c.successToast}
            </Text>
          </YStack>
        ) : null}
      </YStack>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
});
