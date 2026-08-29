import { z } from 'zod';
import { portalSchema } from './common';

/**
 * Password policy: length does most of the work, but we still refuse the
 * obvious shapes. Never accept `role`, `portal` or `userId` from a client.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .refine((v) => /[a-z]/.test(v), 'Must contain a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Must contain an uppercase letter')
  .refine((v) => /[0-9]/.test(v), 'Must contain a digit')
  .refine((v) => !/^(.)\1+$/.test(v), 'Password is too simple');

export const emailSchema = z.email().max(254).trim().toLowerCase();

export const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(80),
  /** TRAVELLER or TOURIST_GUIDE only — ADMIN accounts are invite-only. */
  accountType: z.enum(['TRAVELLER', 'TOURIST_GUIDE']).default('TRAVELLER'),
  acceptTerms: z.literal(true),
});

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
  portal: portalSchema,
});

export const refreshSchema = z.strictObject({
  refreshToken: z.string().min(20).max(512).optional(),
});

export const logoutSchema = z.strictObject({
  allDevices: z.boolean().default(false),
});

export const forgotPasswordSchema = z.strictObject({
  email: emailSchema,
  portal: portalSchema,
});

export const resetPasswordSchema = z.strictObject({
  token: z.string().min(20).max(512),
  password: passwordSchema,
});

export const verifyEmailSchema = z.strictObject({
  token: z.string().min(20).max(512),
});

export const resendVerificationSchema = z.strictObject({
  email: emailSchema,
});

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const totpCodeSchema = z
  .string()
  .regex(/^[0-9]{6}$/, 'Enter the 6-digit code from your authenticator app');

export const adminLoginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const adminTotpSchema = z.strictObject({
  challengeToken: z.string().min(20).max(512),
  code: totpCodeSchema,
});

export const totpEnableSchema = z.strictObject({
  code: totpCodeSchema,
});

export const adminInviteCreateSchema = z.strictObject({
  email: emailSchema,
  role: z.enum(['MODERATOR', 'ADMIN', 'SUPER_ADMIN']),
  note: z.string().trim().max(200).optional(),
});

export const adminInviteAcceptSchema = z.strictObject({
  token: z.string().min(20).max(512),
  displayName: z.string().trim().min(2).max(80),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AdminInviteCreateInput = z.infer<typeof adminInviteCreateSchema>;
