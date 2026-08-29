import { model, type Model, type Types } from 'mongoose';
import { PORTALS } from '../../types';
import { createSchema } from '../plugins/base';

export interface RefreshTokenDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  portal: (typeof PORTALS)[number];
  /** SHA-256 of the opaque token. The token itself is never stored. */
  tokenHash: string;
  familyId: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByHash: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = createSchema<RefreshTokenDocument>({
  userId: { type: 'ObjectId', ref: 'User', required: true },
  portal: { type: String, enum: PORTALS, required: true },
  tokenHash: { type: String, required: true, maxlength: 64 },
  familyId: { type: String, required: true, maxlength: 64 },
  userAgent: { type: String, default: null, maxlength: 300 },
  ip: { type: String, default: null, maxlength: 64 },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: null, maxlength: 64 },
});

export const RefreshTokenModel: Model<RefreshTokenDocument> = model<RefreshTokenDocument>(
  'RefreshToken',
  refreshTokenSchema,
  'refreshtokens',
);

export type VerificationPurpose = 'EMAIL_VERIFY' | 'PASSWORD_RESET' | 'ADMIN_TOTP_CHALLENGE';

export interface VerificationTokenDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  purpose: VerificationPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const verificationTokenSchema = createSchema<VerificationTokenDocument>({
  userId: { type: 'ObjectId', ref: 'User', required: true },
  purpose: {
    type: String,
    enum: ['EMAIL_VERIFY', 'PASSWORD_RESET', 'ADMIN_TOTP_CHALLENGE'],
    required: true,
  },
  tokenHash: { type: String, required: true, maxlength: 64 },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});

export const VerificationTokenModel: Model<VerificationTokenDocument> =
  model<VerificationTokenDocument>(
    'VerificationToken',
    verificationTokenSchema,
    'verificationtokens',
  );

export interface AdminInviteDocument {
  _id: Types.ObjectId;
  email: string;
  role: 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
  tokenHash: string;
  invitedBy: Types.ObjectId;
  note: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedUserId: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const adminInviteSchema = createSchema<AdminInviteDocument>({
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  role: { type: String, enum: ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'], required: true },
  tokenHash: { type: String, required: true, maxlength: 64 },
  invitedBy: { type: 'ObjectId', ref: 'User', required: true },
  note: { type: String, default: '', maxlength: 200 },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null },
  acceptedUserId: { type: 'ObjectId', ref: 'User', default: null },
});

export const AdminInviteModel: Model<AdminInviteDocument> = model<AdminInviteDocument>(
  'AdminInvite',
  adminInviteSchema,
  'admininvites',
);
