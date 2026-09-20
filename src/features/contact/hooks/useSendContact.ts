// useSendContact — E8-03
//
// Envoie le formulaire de contact à l'Edge Function `send-contact`. En cas
// d'erreur, on extrait le code renvoyé par la fonction (429 `rate_limited`,
// `email_failed`…) depuis la Response rangée dans error.context, pour afficher
// un message dédié côté écran. Pattern calqué sur useSuggestCaption.

import { useMutation } from '@tanstack/react-query';

import type { ContactFormValues } from '@/features/contact/schemas/contactSchema';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface SendContactResponse {
  ok?: boolean;
  error?: string;
}

async function sendContact(values: ContactFormValues): Promise<void> {
  const { data, error } = await supabase.functions.invoke<SendContactResponse>('send-contact', {
    body: {
      name: values.name,
      email: values.email,
      phone: values.phone,
      company: values.company,
      subject: values.subject,
      message: values.message,
    },
  });

  if (error) {
    // supabase-js range la Response d'erreur dans error.context → on en extrait
    // le code métier (ex. 'rate_limited') pour un message précis.
    let code = 'failed';
    try {
      const ctx = (error as { context?: { json?: () => Promise<SendContactResponse> } }).context;
      const bodyErr = await ctx?.json?.();
      if (bodyErr?.error) code = bodyErr.error;
    } catch {
      /* corps illisible → code générique */
    }
    throw new Error(code);
  }

  if (!data?.ok) {
    throw new Error(data?.error ?? 'failed');
  }
}

export function useSendContact() {
  return useMutation({
    mutationFn: sendContact,
    onError: (err) => logger.warn('send_contact_failed', { message: (err as Error).message }),
  });
}
