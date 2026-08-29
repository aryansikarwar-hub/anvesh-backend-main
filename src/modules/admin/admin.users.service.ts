import { GuideProfileModel, UserModel } from '../../lib/database';
import { buildPageInfo, escapeRegExp, toSkipLimit } from '../../lib/shared';
import { ERROR_CODES, type Paginated, type PublicUser } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { toPublicUser } from '../auth/auth.mapper';
import { toGuideProfile } from '../guides/guide.service';
import { type AuditService } from './audit.service';

export interface AdminActor {
  userId: string;
  email: string;
}

export class AdminUsersService {
  constructor(private readonly audit: AuditService) {}

  async listUsers(options: {
    page: number;
    limit: number;
    q?: string;
    role?: string;
    status?: string;
  }): Promise<Paginated<PublicUser>> {
    const filter: Record<string, unknown> = {};
    if (options.role) filter.role = options.role;
    if (options.status) filter.status = options.status;
    if (options.q) {
      const rx = new RegExp(escapeRegExp(options.q), 'i');
      filter.$or = [{ email: rx }, { 'profile.displayName': rx }];
    }

    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const [items, total] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      UserModel.countDocuments(filter).exec(),
    ]);
    return {
      items: items.map(toPublicUser),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async getUser(userId: string): Promise<PublicUser> {
    const user = await UserModel.findById(userId).exec();
    if (!user) throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    return toPublicUser(user);
  }

  /**
   * Suspension and role changes are audited with a before/after snapshot.
   * Suspending also bumps tokenVersion so the account's sessions cannot be
   * refreshed.
   */
  async updateUser(
    userId: string,
    patch: { status?: string; role?: string; note?: string },
    actor: AdminActor,
  ): Promise<PublicUser> {
    const user = await UserModel.findById(userId).exec();
    if (!user) throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    if (String(user._id) === actor.userId && patch.status === 'SUSPENDED') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, {
        message: 'You cannot suspend your own account.',
      });
    }

    const before = { status: user.status, role: user.role };
    if (patch.status) user.set('status', patch.status);
    if (patch.role) user.set('role', patch.role);
    if (patch.status === 'SUSPENDED') user.set('tokenVersion', user.tokenVersion + 1);
    await user.save();

    await this.audit.record({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: 'user.update',
      targetType: 'User',
      targetId: userId,
      before,
      after: { status: user.status, role: user.role, note: patch.note ?? '' },
    });

    return toPublicUser(user);
  }

  async listGuides(options: { page: number; limit: number; verified?: boolean; q?: string }) {
    const filter: Record<string, unknown> = {};
    if (typeof options.verified === 'boolean') filter.verified = options.verified;
    if (options.q) {
      const rx = new RegExp(escapeRegExp(options.q), 'i');
      filter.$or = [{ displayName: rx }, { slug: rx }, { baseCity: rx }];
    }
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const [items, total] = await Promise.all([
      GuideProfileModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      GuideProfileModel.countDocuments(filter).exec(),
    ]);
    return {
      items: items.map((i) => toGuideProfile(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async verifyGuide(guideId: string, verified: boolean, note: string, actor: AdminActor) {
    const guide = await GuideProfileModel.findById(guideId).exec();
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    const before = { verified: guide.verified };

    guide.set('verified', verified);
    guide.set('verifiedAt', verified ? new Date() : null);
    guide.set('verifiedBy', verified ? actor.userId : null);
    await guide.save();

    await this.audit.record({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: verified ? 'guide.verify' : 'guide.unverify',
      targetType: 'GuideProfile',
      targetId: guideId,
      before,
      after: { verified, note },
    });

    return toGuideProfile(guide.toObject() as never);
  }
}
