import { Types, type ClientSession } from 'mongoose';
import {
  AdminInviteModel,
  RefreshTokenModel,
  UserModel,
  VerificationTokenModel,
  type AdminInviteDocument,
  type RefreshTokenDocument,
  type UserDocument,
  type VerificationTokenDocument,
} from '../../lib/database';
import { type Portal, type Role } from '../../lib/types';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  portals: Portal[];
  status: 'PENDING' | 'ACTIVE';
}

/**
 * The only place in the auth module that touches Mongoose. Every lookup that
 * resolves an owned record takes the owner id as part of the filter.
 */
export class AuthRepository {
  async findByEmail(email: string, withSecrets = false) {
    const query = UserModel.findOne({ email: email.toLowerCase() });
    if (withSecrets) query.select('+passwordHash +totp.secretEnc +totp.recoveryCodeHashes');
    return query.exec();
  }

  async findById(id: string, withSecrets = false) {
    if (!Types.ObjectId.isValid(id)) return null;
    const query = UserModel.findById(id);
    if (withSecrets) query.select('+passwordHash +totp.secretEnc +totp.recoveryCodeHashes');
    return query.exec();
  }

  async createUser(input: CreateUserInput, session?: ClientSession) {
    const [created] = await UserModel.create(
      [
        {
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          role: input.role,
          portals: input.portals,
          status: input.status,
          profile: { displayName: input.displayName, locale: 'en-IN' },
        },
      ],
      session ? { session } : {},
    );
    return created as UserDocument;
  }

  async updateUser(id: string, update: Record<string, unknown>) {
    return UserModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async bumpTokenVersion(id: string) {
    return UserModel.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { new: true }).exec();
  }

  async registerFailedLogin(id: string, lockUntil: Date | null) {
    const update: Record<string, unknown> = { $inc: { failedLoginCount: 1 } };
    if (lockUntil) update.$set = { lockedUntil: lockUntil };
    return UserModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async clearFailedLogins(id: string) {
    return UserModel.findByIdAndUpdate(id, {
      $set: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    }).exec();
  }

  // --- refresh tokens ------------------------------------------------------

  async storeRefreshToken(input: {
    userId: string;
    portal: Portal;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent: string | null;
    ip: string | null;
  }): Promise<RefreshTokenDocument> {
    const [created] = await RefreshTokenModel.create([input]);
    return created as RefreshTokenDocument;
  }

  async findRefreshToken(tokenHash: string) {
    return RefreshTokenModel.findOne({ tokenHash }).exec();
  }

  async rotateRefreshToken(id: Types.ObjectId, replacedByHash: string) {
    return RefreshTokenModel.findByIdAndUpdate(id, {
      $set: { revokedAt: new Date(), replacedByHash },
    }).exec();
  }

  async revokeFamily(familyId: string) {
    return RefreshTokenModel.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ).exec();
  }

  async revokeAllForUser(userId: string) {
    return RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ).exec();
  }

  // --- one-time tokens -----------------------------------------------------

  async storeVerificationToken(input: {
    userId: string;
    purpose: VerificationTokenDocument['purpose'];
    tokenHash: string;
    expiresAt: Date;
  }) {
    await VerificationTokenModel.deleteMany({ userId: input.userId, purpose: input.purpose });
    const [created] = await VerificationTokenModel.create([input]);
    return created as VerificationTokenDocument;
  }

  async consumeVerificationToken(tokenHash: string, purpose: VerificationTokenDocument['purpose']) {
    return VerificationTokenModel.findOneAndUpdate(
      { tokenHash, purpose, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { new: true },
    ).exec();
  }

  // --- admin invites -------------------------------------------------------

  async createInvite(input: {
    email: string;
    role: AdminInviteDocument['role'];
    tokenHash: string;
    invitedBy: string;
    note: string;
    expiresAt: Date;
  }) {
    const [created] = await AdminInviteModel.create([input]);
    return created as AdminInviteDocument;
  }

  async findInviteByTokenHash(tokenHash: string) {
    return AdminInviteModel.findOne({ tokenHash }).exec();
  }

  async markInviteAccepted(id: Types.ObjectId, userId: Types.ObjectId) {
    return AdminInviteModel.findByIdAndUpdate(id, {
      $set: { acceptedAt: new Date(), acceptedUserId: userId },
    }).exec();
  }

  async listInvites(limit: number, skip: number) {
    const [items, total] = await Promise.all([
      AdminInviteModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      AdminInviteModel.countDocuments().exec(),
    ]);
    return { items, total };
  }
}
