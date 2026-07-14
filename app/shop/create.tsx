// Écran Création d'annonce — E7-14 (#245)
//
// Stack : React Hook Form + Zod (cf CLAUDE.md). On valide le formulaire avant
// d'uploader la moindre image — pas de réseau gaspillé si l'user envoie un
// titre vide.
//
// Submit pipeline :
//   1. Validation Zod (échec → erreurs inline)
//   2. Upload séquentiel des images vers le bucket `listings/<user_id>/...`
//      (échec d'une image → on stoppe et on alert ; l'user peut retry)
//   3. RPC create_listing(...) avec les URLs publiques
//   4. router.replace vers /shop/[newId] pour atterrir sur la fiche fraîche
//
// Note : on n'upload pas en background pendant que l'user remplit le titre —
// le bénéfice (gain de quelques secondes) ne vaut pas la complexité (gérer
// l'annulation, le nettoyage des orphans en cas d'abandon).

import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Text, TextArea, View, XStack, YStack } from 'tamagui';
import { z } from 'zod';

import { ListingImagePicker } from '@/features/marketplace/components/ListingImagePicker';
import { SegmentedChoice } from '@/features/marketplace/components/SegmentedChoice';
import { useCreateListing } from '@/features/marketplace/hooks/useCreateListing';
import { useTranslations, type Translations } from '@/i18n';
import { logger } from '@/lib/logger';
import { uploadListingImage } from '@/lib/storage';

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 2000;
const MAX_IMAGES = 4;
const MAX_PRICE_EUR = 999_999;

const CategoryEnum = z.enum(['product', 'service']);
const ConditionEnum = z.enum(['neuf', 'tres_bon_etat', 'bon_etat', 'occasion']);

// Le schéma est construit à partir des traductions pour que les messages
// d'erreur suivent la langue active. On dérive `FormValues` du type de retour.
function buildListingSchema(t: Translations) {
  const e = t.marketplace.create.errors;
  return z
    .object({
      category: CategoryEnum,
      title: z.string().trim().min(3, e.titleMin).max(MAX_TITLE, e.maxChars(MAX_TITLE)),
      description: z
        .string()
        .trim()
        .min(10, e.descriptionMin)
        .max(MAX_DESCRIPTION, e.maxChars(MAX_DESCRIPTION)),
      // Le user tape un montant en euros, on convertit en cents au submit.
      priceEuros: z
        .string()
        .trim()
        .min(1, e.priceRequired)
        .refine((v) => /^\d+([.,]\d{1,2})?$/.test(v), e.priceFormat)
        .refine((v) => {
          const num = Number.parseFloat(v.replace(',', '.'));
          return Number.isFinite(num) && num > 0 && num <= MAX_PRICE_EUR;
        }, e.priceRange(MAX_PRICE_EUR)),
      location: z.string().trim().max(120).optional(),
      condition: ConditionEnum.nullable().optional(),
    })
    .refine((data) => data.category === 'product' || data.condition == null, {
      message: e.conditionProductOnly,
      path: ['condition'],
    });
}

type FormValues = z.infer<ReturnType<typeof buildListingSchema>>;

export default function CreateListingScreen() {
  const t = useTranslations();
  const insets = useSafeAreaInsets();
  const createListing = useCreateListing();

  const [images, setImages] = useState<string[]>([]);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  // Schéma + options mémoïsés sur `t` : reconstruits au changement de langue.
  const listingSchema = useMemo(() => buildListingSchema(t), [t]);

  const categoryOptions = useMemo(
    () => [
      { value: 'product' as const, label: t.marketplace.create.category.product },
      { value: 'service' as const, label: t.marketplace.create.category.service },
    ],
    [t]
  );

  const conditionOptions = useMemo(
    () => [
      { value: 'neuf' as const, label: t.marketplace.condition.neuf },
      { value: 'tres_bon_etat' as const, label: t.marketplace.condition.tres_bon_etat },
      { value: 'bon_etat' as const, label: t.marketplace.condition.bon_etat },
      { value: 'occasion' as const, label: t.marketplace.condition.occasion },
    ],
    [t]
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      category: 'product',
      title: '',
      description: '',
      priceEuros: '',
      location: '',
      condition: null,
    },
    mode: 'onSubmit',
  });

  const category = watch('category');

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/shop');
  }, []);

  const handleClose = useCallback(() => {
    Alert.alert(t.marketplace.create.discardTitle, t.marketplace.create.discardMessage, [
      { text: t.marketplace.create.discardKeepEditing, style: 'cancel' },
      { text: t.marketplace.create.discardConfirm, style: 'destructive', onPress: handleBack },
    ]);
  }, [handleBack, t]);

  const onSubmit = useCallback(
    async (values: FormValues) => {
      // Garde-fou côté formulaire : au moins 1 image.
      if (images.length === 0) {
        setImagesError(t.marketplace.create.errors.imageRequired);
        return;
      }
      setImagesError(null);

      // Conversion euros → cents (la regex Zod garantit le format).
      const euros = Number.parseFloat(values.priceEuros.replace(',', '.'));
      const priceCents = Math.round(euros * 100);

      // Upload séquentiel — un échec stoppe et l'user retry (on garde la
      // saisie). On pourrait paralléliser mais pour 1-4 images, ça n'apporte
      // pas grand chose et l'erreur est plus lisible séquentiellement.
      try {
        setUploadProgress({ done: 0, total: images.length });
        const publicUrls: string[] = [];
        for (let i = 0; i < images.length; i++) {
          const uri = images[i];
          if (!uri) continue;
          const result = await uploadListingImage(uri);
          publicUrls.push(result.publicUrl);
          setUploadProgress({ done: i + 1, total: images.length });
        }
        setUploadProgress(null);

        const newId = await createListing.mutateAsync({
          category: values.category,
          title: values.title.trim(),
          description: values.description.trim(),
          price_cents: priceCents,
          currency: 'EUR',
          images: publicUrls,
          location: values.location?.trim() || null,
          condition: values.category === 'product' ? (values.condition ?? null) : null,
        });

        // Replace pour que le back de la fiche atterrisse sur la grille
        // (et pas sur le formulaire vide).
        router.replace(`/shop/${newId}`);
      } catch (err) {
        setUploadProgress(null);
        const message =
          err instanceof Error ? err.message : t.marketplace.create.submitErrorFallback;
        logger.warn('create_listing submit failed', { message });
        Alert.alert(t.marketplace.create.submitErrorTitle, message);
      }
    },
    [createListing, images, t]
  );

  const isBusy = isSubmitting || createListing.isPending || uploadProgress !== null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View flex={1} backgroundColor="$background" paddingTop={insets.top}>
          {/* Header */}
          <XStack
            height={56}
            paddingHorizontal={12}
            alignItems="center"
            gap={12}
            borderBottomWidth={StyleSheet.hairlineWidth}
            borderBottomColor="$borderColor"
          >
            <Pressable
              onPress={handleClose}
              disabled={isBusy}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t.marketplace.common.cancel}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </Pressable>
            <Text flex={1} color="$color" fontSize={18} fontWeight="700">
              {t.marketplace.create.title}
            </Text>
          </XStack>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Section Photos */}
            <Section title={t.marketplace.create.sections.photos} required>
              <ListingImagePicker
                images={images}
                onChange={(next) => {
                  setImages(next);
                  if (next.length > 0) setImagesError(null);
                }}
                maxImages={MAX_IMAGES}
                disabled={isBusy}
              />
              {imagesError ? <ErrorText>{imagesError}</ErrorText> : null}
            </Section>

            {/* Section Catégorie */}
            <Section title={t.marketplace.create.sections.category} required>
              <Controller
                control={control}
                name="category"
                render={({ field: { value, onChange } }) => (
                  <SegmentedChoice
                    options={categoryOptions}
                    value={value}
                    onChange={(next) => {
                      onChange(next);
                      // Reset condition si on bascule sur service
                      if (next === 'service') setValue('condition', null);
                    }}
                    disabled={isBusy}
                  />
                )}
              />
            </Section>

            {/* Section Titre */}
            <Section title={t.marketplace.create.sections.title} required>
              <Controller
                control={control}
                name="title"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t.marketplace.create.titlePlaceholder}
                    placeholderTextColor="$placeholderColor"
                    maxLength={MAX_TITLE}
                    editable={!isBusy}
                    color="$color"
                    backgroundColor="$surface"
                    borderWidth={0}
                    borderRadius="$md"
                    height={48}
                    paddingHorizontal={14}
                    accessibilityLabel={t.marketplace.create.titleA11y}
                  />
                )}
              />
              {errors.title ? <ErrorText>{errors.title.message}</ErrorText> : null}
            </Section>

            {/* Section Description */}
            <Section title={t.marketplace.create.sections.description} required>
              <Controller
                control={control}
                name="description"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextArea
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t.marketplace.create.descriptionPlaceholder}
                    placeholderTextColor="$placeholderColor"
                    maxLength={MAX_DESCRIPTION}
                    editable={!isBusy}
                    color="$color"
                    backgroundColor="$surface"
                    borderWidth={0}
                    borderRadius="$md"
                    minHeight={120}
                    paddingHorizontal={14}
                    paddingTop={12}
                    textAlignVertical="top"
                    accessibilityLabel={t.marketplace.create.descriptionA11y}
                  />
                )}
              />
              {errors.description ? <ErrorText>{errors.description.message}</ErrorText> : null}
            </Section>

            {/* Section Prix */}
            <Section title={t.marketplace.create.sections.price} required>
              <Controller
                control={control}
                name="priceEuros"
                render={({ field: { value, onChange, onBlur } }) => (
                  <XStack
                    alignItems="center"
                    gap={8}
                    backgroundColor="$surface"
                    borderRadius="$md"
                    paddingHorizontal={14}
                    height={48}
                  >
                    <Input
                      flex={1}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder={t.marketplace.create.pricePlaceholder}
                      placeholderTextColor="$placeholderColor"
                      keyboardType="decimal-pad"
                      editable={!isBusy}
                      color="$color"
                      backgroundColor="transparent"
                      borderWidth={0}
                      paddingHorizontal={0}
                      height={48}
                      accessibilityLabel={t.marketplace.create.priceA11y}
                    />
                    <Text color="$textSecondary" fontSize={16} fontWeight="600">
                      €
                    </Text>
                  </XStack>
                )}
              />
              {errors.priceEuros ? <ErrorText>{errors.priceEuros.message}</ErrorText> : null}
            </Section>

            {/* Section État (uniquement si product) */}
            {category === 'product' ? (
              <Section
                title={t.marketplace.create.sections.condition}
                subtitle={t.marketplace.create.optional}
              >
                <Controller
                  control={control}
                  name="condition"
                  render={({ field: { value, onChange } }) => (
                    <SegmentedChoice
                      options={conditionOptions}
                      value={value ?? null}
                      onChange={onChange}
                      allowDeselect
                      onDeselect={() => onChange(null)}
                      disabled={isBusy}
                    />
                  )}
                />
              </Section>
            ) : null}

            {/* Section Localisation */}
            <Section
              title={t.marketplace.create.sections.location}
              subtitle={t.marketplace.create.optional}
            >
              <Controller
                control={control}
                name="location"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t.marketplace.create.locationPlaceholder}
                    placeholderTextColor="$placeholderColor"
                    maxLength={120}
                    editable={!isBusy}
                    color="$color"
                    backgroundColor="$surface"
                    borderWidth={0}
                    borderRadius="$md"
                    height={48}
                    paddingHorizontal={14}
                    accessibilityLabel={t.marketplace.create.locationA11y}
                  />
                )}
              />
            </Section>

            {uploadProgress ? (
              <Text fontSize={12} color="$textSecondary" textAlign="center" marginTop={8}>
                {t.marketplace.create.uploadProgress(uploadProgress.done, uploadProgress.total)}
              </Text>
            ) : null}
          </ScrollView>

          {/* CTA sticky bottom */}
          <YStack
            paddingHorizontal={16}
            paddingTop={12}
            paddingBottom={insets.bottom + 12}
            backgroundColor="$background"
            borderTopWidth={StyleSheet.hairlineWidth}
            borderTopColor="$borderColor"
          >
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel={t.marketplace.create.submitA11y}
              accessibilityState={{ disabled: isBusy }}
              style={[styles.cta, { backgroundColor: isBusy ? '#1A1A1A' : '#10D970' }]}
            >
              {isBusy ? (
                <ActivityIndicator color="#10D970" />
              ) : (
                <Text fontSize={15} fontWeight="800" color="#000000">
                  {t.marketplace.create.submitCta}
                </Text>
              )}
            </Pressable>
          </YStack>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function Section({
  title,
  subtitle,
  required,
  children,
}: {
  title: string;
  subtitle?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <YStack gap={10} marginTop={20}>
      <XStack alignItems="baseline" gap={6}>
        <Text fontSize={14} fontWeight="700" color="$color">
          {title}
        </Text>
        {required ? (
          <Text fontSize={12} color="#10D970" fontWeight="700">
            *
          </Text>
        ) : null}
        {subtitle ? (
          <Text fontSize={11} color="$textSecondary">
            · {subtitle}
          </Text>
        ) : null}
      </XStack>
      {children}
    </YStack>
  );
}

function ErrorText({ children }: { children: string | undefined }) {
  if (!children) return null;
  return (
    <Text fontSize={12} color="#FF6B6B" marginTop={4}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  cta: {
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
