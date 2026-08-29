import { type Types } from 'mongoose';
import { ERROR_CODES, type GuideEarnings, type GuideProfile } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { encryptSecret, maskAccountNumber } from './guide.crypto';
import { type BookingRepository } from '../bookings/booking.repository';
import { type GuideRepository } from './guide.repository';

export class GuideService {
  constructor(
    private readonly repo: GuideRepository,
    private readonly bookings: BookingRepository,
    private readonly payoutKey: string,
  ) {}

  async getPublicBySlug(slug: string): Promise<GuideProfile> {
    const guide = await this.repo.findBySlug(slug);
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    return toGuideProfile(guide as never);
  }

  async getMine(userId: string): Promise<GuideProfile> {
    const guide = await this.repo.findOwnedBy(userId);
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    return toGuideProfile(guide.toObject() as never);
  }

  async updateMine(userId: string, patch: Record<string, unknown>): Promise<GuideProfile> {
    const updated = await this.repo.updateOwned(userId, { $set: patch });
    if (!updated) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    return toGuideProfile(updated.toObject() as never);
  }

  /** The account number is encrypted at rest; only the last four are readable. */
  async updatePayout(userId: string, input: Record<string, string>): Promise<{ masked: string }> {
    const accountNumber = String(input.accountNumber);
    const updated = await this.repo.updateOwned(userId, {
      $set: {
        'payout.accountHolderName': input.accountHolderName,
        'payout.accountNumberEnc': encryptSecret(accountNumber, this.payoutKey),
        'payout.accountNumberLast4': accountNumber.slice(-4),
        'payout.ifsc': input.ifsc,
        'payout.bankName': input.bankName,
        'payout.upiId': input.upiId ?? null,
        'payout.verified': false,
      },
    });
    if (!updated) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    return { masked: maskAccountNumber(accountNumber) };
  }

  async getEarnings(userId: string): Promise<GuideEarnings> {
    const guide = await this.repo.findOwnedBy(userId);
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);

    const monthly = await this.bookings.aggregateGuideEarnings(guide._id as Types.ObjectId);
    const lifetimeGrossMinor = monthly.reduce((sum, row) => sum + row.grossMinor, 0);
    const lifetimeNetMinor = monthly.reduce((sum, row) => sum + row.netMinor, 0);
    const lifetimeCommissionMinor = monthly.reduce((sum, row) => sum + row.commissionMinor, 0);

    return {
      currency: 'INR',
      lifetimeGrossMinor,
      lifetimeCommissionMinor,
      lifetimeNetMinor,
      paidOutMinor: guide.stats.paidOutMinor,
      pendingPayoutMinor: Math.max(0, lifetimeNetMinor - guide.stats.paidOutMinor),
      monthly: monthly.map((row) => ({
        month: row._id ?? 'unknown',
        grossMinor: row.grossMinor,
        netMinor: row.netMinor,
        bookings: row.bookings,
      })),
    };
  }
}

interface GuideRow {
  _id: unknown;
  userId: unknown;
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  languages: string[];
  specialities: string[];
  yearsExperience: number;
  baseCity: string;
  baseState: string;
  verified: boolean;
  verifiedAt: Date | null;
  ratingAvg: number;
  ratingCount: number;
  responseRate: number;
  createdAt: Date;
}

export function toGuideProfile(row: GuideRow): GuideProfile {
  return {
    id: String(row._id),
    userId: String(row.userId),
    slug: row.slug,
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    ...(row.avatarUrl ? { avatarUrl: row.avatarUrl } : {}),
    ...(row.coverImageUrl ? { coverImageUrl: row.coverImageUrl } : {}),
    languages: row.languages,
    specialities: row.specialities,
    yearsExperience: row.yearsExperience,
    baseCity: row.baseCity,
    baseState: row.baseState,
    verified: row.verified,
    ...(row.verifiedAt ? { verifiedAt: row.verifiedAt.toISOString() } : {}),
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    responseRate: row.responseRate,
    createdAt: row.createdAt.toISOString(),
  };
}
