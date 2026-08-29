import { Types } from 'mongoose';
import { withTransaction } from '../../lib/database';
import { bookingCode, buildPageInfo, toSkipLimit } from '../../lib/shared';
import { type Env } from '../../lib/config';
import {
  BOOKING_TRANSITIONS,
  ERROR_CODES,
  type Booking,
  type BookingStatus,
  type Paginated,
} from '../../lib/types';
import { type BookingCreateInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { type AvailabilityRepository } from '../availability/availability.repository';
import { type ExperienceRepository } from '../experiences/experience.repository';
import { type GuideRepository } from '../guides/guide.repository';
import { type AuthRepository } from '../auth/auth.repository';
import { computeBookingAmounts } from './booking.pricing';
import { type BookingRepository } from './booking.repository';
import { toBooking } from './booking.mapper';

export interface BookingActor {
  userId: string;
  idempotencyKey: string;
}

export class BookingService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly slots: AvailabilityRepository,
    private readonly experiences: ExperienceRepository,
    private readonly guides: GuideRepository,
    private readonly users: AuthRepository,
    private readonly env: Env,
  ) {}

  /**
   * Creates a booking and holds the seats.
   *
   * The seat decrement is a single atomic conditional update inside a
   * transaction; if two travellers race for the last seat exactly one of them
   * gets it and the other receives SLOT_SOLD_OUT. Nothing here takes a lock.
   */
  async create(input: BookingCreateInput, actor: BookingActor): Promise<Booking> {
    const existing = await this.repo.findByIdempotencyKey(actor.idempotencyKey);
    if (existing) {
      if (String(existing.userId) !== actor.userId) {
        throw new AppError(ERROR_CODES.IDEMPOTENCY_KEY_REUSED);
      }
      return toBooking(existing);
    }

    const slot = await this.slots.findOpenById(input.slotId);
    if (!slot) throw new AppError(ERROR_CODES.SLOT_NOT_FOUND);
    if (slot.status !== 'OPEN') throw new AppError(ERROR_CODES.SLOT_CLOSED);
    if (slot.startAt.getTime() <= Date.now()) throw new AppError(ERROR_CODES.SLOT_IN_PAST);

    const experience = await this.experiences.findPublishedById(String(slot.experienceId));
    if (!experience) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_PUBLISHED);

    const user = await this.users.findById(actor.userId);
    if (!user) throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    if (!user.emailVerifiedAt) throw new AppError(ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED);

    const amounts = computeBookingAmounts({
      unitPriceMinor: slot.priceMinor,
      seats: input.seats,
      commissionBps: this.env.PLATFORM_COMMISSION_BPS,
    });

    return withTransaction(async (session) => {
      const reserved = await this.slots.reserveSeats(slot._id, input.seats, session);
      if (!reserved) {
        throw new AppError(ERROR_CODES.SLOT_SOLD_OUT, {
          details: { requested: input.seats },
        });
      }

      const cover = (experience.images?.[0] as { url?: string } | undefined)?.url ?? null;
      const created = await this.repo.create(
        {
          code: bookingCode(),
          userId: new Types.ObjectId(actor.userId),
          guideId: slot.guideId,
          experienceId: experience._id,
          slotId: slot._id,
          status: 'PENDING_PAYMENT',
          ...amounts,
          startAt: slot.startAt,
          endAt: slot.endAt,
          experienceTitle: experience.title,
          experienceSlug: experience.slug,
          coverImageUrl: cover,
          guideSummary: experience.guideSummary,
          travellerName: user.profile.displayName,
          travellerEmail: user.email,
          travellerNote: input.travellerNote,
          idempotencyKey: actor.idempotencyKey,
          expiresAt: new Date(Date.now() + this.env.BOOKING_HOLD_MINUTES * 60_000),
          timeline: [{ status: 'PENDING_PAYMENT', at: new Date(), by: 'USER', reason: '' }],
        },
        session,
      );

      return toBooking(created);
    });
  }

  async getForUser(userId: string, bookingId: string): Promise<Booking> {
    const booking = await this.repo.findOwnedByUser(userId, bookingId);
    if (!booking) throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND);
    return toBooking(booking);
  }

  async listForUser(
    userId: string,
    options: { page: number; limit: number; status?: BookingStatus },
  ): Promise<Paginated<Booking>> {
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const { items, total } = await this.repo.listForUser(
      userId,
      options.status ? { status: options.status } : {},
      skip,
      limit,
    );
    return {
      items: items.map((i) => toBooking(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async cancelByUser(userId: string, bookingId: string, reason: string): Promise<Booking> {
    const booking = await this.repo.findOwnedByUser(userId, bookingId);
    if (!booking) throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND);
    assertTransition(booking.status, 'CANCELLED_BY_USER');

    if (booking.startAt.getTime() - Date.now() < 24 * 3_600_000) {
      throw new AppError(ERROR_CODES.BOOKING_NOT_CANCELLABLE, {
        message: 'Bookings cannot be cancelled within 24 hours of the start time.',
      });
    }

    return withTransaction(async (session) => {
      await this.slots.releaseSeats(booking.slotId, booking.seats, session);
      const updated = await this.repo.updateStatus(
        booking._id,
        'CANCELLED_BY_USER',
        'USER',
        reason,
        {},
        session,
      );
      return toBooking(updated as never);
    });
  }

  // --- guide scope ---------------------------------------------------------

  async listForGuide(
    userId: string,
    options: { page: number; limit: number; status?: BookingStatus; experienceId?: string },
  ): Promise<Paginated<Booking>> {
    const guide = await this.requireGuide(userId);
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const filter: Record<string, unknown> = {};
    if (options.status) filter.status = options.status;
    if (options.experienceId) filter.experienceId = new Types.ObjectId(options.experienceId);
    const { items, total } = await this.repo.listForGuide(String(guide._id), filter, skip, limit);
    return {
      items: items.map((i) => toBooking(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async getForGuide(userId: string, bookingId: string): Promise<Booking> {
    const guide = await this.requireGuide(userId);
    const booking = await this.repo.findOwnedByGuide(String(guide._id), bookingId);
    if (!booking) throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND);
    return toBooking(booking);
  }

  async actAsGuide(
    userId: string,
    bookingId: string,
    action: 'CANCEL' | 'COMPLETE',
    reason: string,
  ): Promise<Booking> {
    const guide = await this.requireGuide(userId);
    const booking = await this.repo.findOwnedByGuide(String(guide._id), bookingId);
    if (!booking) throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND);

    if (action === 'COMPLETE') {
      assertTransition(booking.status, 'COMPLETED');
      if (booking.endAt.getTime() > Date.now()) {
        throw new AppError(ERROR_CODES.BOOKING_INVALID_STATE, {
          message: 'This experience has not finished yet.',
        });
      }
      const updated = await this.repo.updateStatus(booking._id, 'COMPLETED', 'GUIDE', reason);
      return toBooking(updated as never);
    }

    assertTransition(booking.status, 'CANCELLED_BY_GUIDE');
    return withTransaction(async (session) => {
      await this.slots.releaseSeats(booking.slotId, booking.seats, session);
      const updated = await this.repo.updateStatus(
        booking._id,
        'CANCELLED_BY_GUIDE',
        'GUIDE',
        reason,
        {},
        session,
      );
      return toBooking(updated as never);
    });
  }

  /** Called by the cleanup worker; releases seats held by unpaid bookings. */
  async expireStale(limit = 50): Promise<number> {
    const stale = await this.repo.findExpired(limit);
    for (const booking of stale) {
      await withTransaction(async (session) => {
        await this.slots.releaseSeats(booking.slotId, booking.seats, session);
        await this.repo.updateStatus(
          booking._id,
          'EXPIRED',
          'SYSTEM',
          'Payment was not completed in time',
          {},
          session,
        );
      });
    }
    return stale.length;
  }

  private async requireGuide(userId: string) {
    const guide = await this.guides.findOwnedBy(userId);
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    return guide;
  }
}

/** The booking state machine is explicit; anything not listed is rejected. */
export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!BOOKING_TRANSITIONS[from].includes(to)) {
    throw new AppError(ERROR_CODES.BOOKING_INVALID_STATE, {
      message: `A booking cannot go from ${from} to ${to}.`,
      details: { from, to, allowed: BOOKING_TRANSITIONS[from] },
    });
  }
}
