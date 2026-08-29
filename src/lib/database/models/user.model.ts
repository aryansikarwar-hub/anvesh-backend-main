import { model, type Model, type Types } from 'mongoose';
import { PORTALS, ROLES, USER_STATUSES, BUDGET_BANDS } from '../../types';
import { createSchema, unitInterval } from '../plugins/base';

export interface UserDocument {
  _id: Types.ObjectId;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  role: (typeof ROLES)[number];
  portals: (typeof PORTALS)[number][];
  status: (typeof USER_STATUSES)[number];
  tokenVersion: number;
  totp: {
    enabled: boolean;
    secretEnc: string | null;
    confirmedAt: Date | null;
    recoveryCodeHashes: string[];
  };
  profile: {
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    phone?: string;
    city?: string;
    state?: string;
    locale: string;
  };
  preferences: {
    interests: string[];
    travelStyles: string[];
    budgetBand: (typeof BUDGET_BANDS)[number];
    crowdTolerance: number;
    prefersLocalOwned: boolean;
    dietary: string[];
    languages: string[];
    homeCity?: string;
  };
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = createSchema<UserDocument>({
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  emailVerifiedAt: { type: Date, default: null },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true, default: 'TRAVELLER' },
  portals: { type: [String], enum: PORTALS, required: true, default: ['TRAVELLER'] },
  status: { type: String, enum: USER_STATUSES, required: true, default: 'PENDING' },
  tokenVersion: { type: Number, required: true, default: 0, min: 0 },
  totp: {
    enabled: { type: Boolean, required: true, default: false },
    secretEnc: { type: String, default: null, select: false },
    confirmedAt: { type: Date, default: null },
    recoveryCodeHashes: { type: [String], default: [], select: false },
  },
  profile: {
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    avatarUrl: { type: String, maxlength: 1000 },
    bio: { type: String, maxlength: 600 },
    phone: { type: String, maxlength: 16, select: false },
    city: { type: String, maxlength: 120 },
    state: { type: String, maxlength: 120 },
    locale: { type: String, required: true, default: 'en-IN', maxlength: 10 },
  },
  preferences: {
    interests: { type: [String], default: [] },
    travelStyles: { type: [String], default: [] },
    budgetBand: { type: String, enum: BUDGET_BANDS, required: true, default: 'MID' },
    crowdTolerance: unitInterval(0.4),
    prefersLocalOwned: { type: Boolean, required: true, default: true },
    dietary: { type: [String], default: [] },
    languages: { type: [String], default: ['en'] },
    homeCity: { type: String, maxlength: 120 },
  },
  failedLoginCount: { type: Number, required: true, default: 0, min: 0 },
  lockedUntil: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
});

export const UserModel: Model<UserDocument> = model<UserDocument>('User', userSchema, 'users');
