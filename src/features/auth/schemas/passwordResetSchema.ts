import { z } from 'zod';

import type { AuthValidation } from '@/i18n';

export const createForgotPasswordSchema = (v: AuthValidation) =>
  z.object({
    email: z.string().email(v.invalidEmail),
  });

export const createResetPasswordSchema = (v: AuthValidation) =>
  z
    .object({
      password: z.string().min(8, v.passwordMinLength),
      confirmPassword: z.string().min(8, v.confirmationRequired),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: v.passwordsDoNotMatch,
      path: ['confirmPassword'],
    });

export type ForgotPasswordFormValues = z.infer<ReturnType<typeof createForgotPasswordSchema>>;
export type ResetPasswordFormValues = z.infer<ReturnType<typeof createResetPasswordSchema>>;
