import { Types } from 'mongoose';
import { buildPageInfo, toSkipLimit } from '../../lib/shared';
import { ERROR_CODES, type AvailabilitySlot, type Paginated } from '../../lib/types';
import { type SlotBulkCreateInput, type SlotCreateInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { type GuideRepository } from '../guides/guide.repository';
import { type ExperienceRepository } from '../experiences/experience.repository';
import { type AvailabilityRepository } from './availability.repository';

const MAX_GENERATED_SLOTS = 200;

export class AvailabilityService {
  constructor(
    private readonly repo: AvailabilityRepository,
    private readonly guides: GuideRepository,
    private readonly experiences: ExperienceRepository,
  ) {}

  async listPublic(experienceId: string, from?: string, to?: string): Promise<AvailabilitySlot[]> {
    const experience = await this.experiences.findPublishedById(experienceId);
    if (!experience) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(Date.now() + 90 * 86_400_000);
    const slots = await this.repo.listPublic(experienceId, start, end);
    return slots.map(toSlot);
  }

  async createOne(userId: string, input: SlotCreateInput): Promise<AvailabilitySlot> {
    const guide = await this.requireGuide(userId);
    const experience = await this.experiences.findOwned(String(guide._id), input.experienceId);
    if (!experience) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (startAt.getTime() <= Date.now()) throw new AppError(ERROR_CODES.SLOT_IN_PAST);
    if (await this.repo.overlaps(experience._id, startAt, endAt)) {
      throw new AppError(ERROR_CODES.SLOT_OVERLAP);
    }
    if (input.seatsTotal > experience.maxSeats) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, {
        message: `This experience is capped at ${experience.maxSeats} seats.`,
      });
    }

    const created = await this.repo.create({
      experienceId: experience._id,
      guideId: guide._id,
      startAt,
      endAt,
      seatsTotal: input.seatsTotal,
      seatsAvailable: input.seatsTotal,
      priceMinor: input.priceMinor,
    });
    return toSlot(created as never);
  }

  /** Generates a bounded run of slots from a weekly pattern. */
  async createBulk(userId: string, input: SlotBulkCreateInput): Promise<{ created: number }> {
    const guide = await this.requireGuide(userId);
    const experience = await this.experiences.findOwned(String(guide._id), input.experienceId);
    if (!experience) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
    if (input.seatsTotal > experience.maxSeats) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, {
        message: `This experience is capped at ${experience.maxSeats} seats.`,
      });
    }

    const documents: Record<string, unknown>[] = [];
    const from = new Date(`${input.fromDate}T00:00:00.000Z`);
    const to = new Date(`${input.toDate}T00:00:00.000Z`);

    for (let day = new Date(from); day <= to; day.setUTCDate(day.getUTCDate() + 1)) {
      if (!input.weekdays.includes(day.getUTCDay())) continue;
      const startAt = new Date(day);
      // Times are given in IST; the stored value is UTC.
      startAt.setUTCMinutes(startAt.getUTCMinutes() + input.startTimeMin - 330);
      if (startAt.getTime() <= Date.now()) continue;
      documents.push({
        experienceId: experience._id,
        guideId: guide._id,
        startAt: new Date(startAt),
        endAt: new Date(startAt.getTime() + input.durationMin * 60_000),
        seatsTotal: input.seatsTotal,
        seatsAvailable: input.seatsTotal,
        priceMinor: input.priceMinor,
      });
      if (documents.length >= MAX_GENERATED_SLOTS) break;
    }

    if (documents.length === 0) return { created: 0 };
    // The unique (experienceId, startAt) index makes this idempotent: a repeat
    // run skips the duplicates instead of doubling the calendar.
    const inserted = await this.repo.createMany(documents).catch((error: unknown) => {
      const mongo = error as { insertedDocs?: unknown[] };
      if (Array.isArray(mongo.insertedDocs)) return mongo.insertedDocs;
      throw error;
    });
    return { created: Array.isArray(inserted) ? inserted.length : 0 };
  }

  async listForGuide(
    userId: string,
    options: { page: number; limit: number; experienceId?: string; from?: string; to?: string; status?: string },
  ): Promise<Paginated<AvailabilitySlot>> {
    const guide = await this.requireGuide(userId);
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const filter: Record<string, unknown> = {};
    if (options.experienceId) filter.experienceId = new Types.ObjectId(options.experienceId);
    if (options.status) filter.status = options.status;
    if (options.from || options.to) {
      filter.startAt = {
        ...(options.from ? { $gte: new Date(options.from) } : {}),
        ...(options.to ? { $lte: new Date(options.to) } : {}),
      };
    }
    const { items, total } = await this.repo.listOwned(String(guide._id), filter, skip, limit);
    return {
      items: items.map((i) => toSlot(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async updateForGuide(
    userId: string,
    id: string,
    patch: { seatsTotal?: number; priceMinor?: number; status?: 'OPEN' | 'CLOSED' },
  ): Promise<AvailabilitySlot> {
    const guide = await this.requireGuide(userId);
    const slot = await this.repo.findOwned(String(guide._id), id);
    if (!slot) throw new AppError(ERROR_CODES.SLOT_NOT_FOUND);

    const set: Record<string, unknown> = {};
    if (patch.priceMinor !== undefined) set.priceMinor = patch.priceMinor;
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.seatsTotal !== undefined) {
      const booked = slot.seatsTotal - slot.seatsAvailable;
      if (patch.seatsTotal < booked) {
        throw new AppError(ERROR_CODES.BAD_REQUEST, {
          message: `${booked} seats are already booked on this slot.`,
        });
      }
      set.seatsTotal = patch.seatsTotal;
      set.seatsAvailable = patch.seatsTotal - booked;
    }

    const updated = await this.repo.updateOwned(String(guide._id), id, { $set: set });
    return toSlot(updated as never);
  }

  async cancelForGuide(userId: string, id: string): Promise<void> {
    const guide = await this.requireGuide(userId);
    const slot = await this.repo.findOwned(String(guide._id), id);
    if (!slot) throw new AppError(ERROR_CODES.SLOT_NOT_FOUND);
    if (slot.seatsAvailable < slot.seatsTotal) {
      throw new AppError(ERROR_CODES.SLOT_HAS_BOOKINGS, {
        message: 'Cancel the bookings on this slot first; travellers must be refunded.',
      });
    }
    await this.repo.updateOwned(String(guide._id), id, { $set: { status: 'CANCELLED' } });
  }

  private async requireGuide(userId: string) {
    const guide = await this.guides.findOwnedBy(userId);
    if (!guide) throw new AppError(ERROR_CODES.GUIDE_NOT_FOUND);
    return guide;
  }
}

interface SlotRow {
  _id: unknown;
  experienceId: unknown;
  guideId: unknown;
  startAt: Date;
  endAt: Date;
  timezone: string;
  seatsTotal: number;
  seatsAvailable: number;
  priceMinor: number;
  currency: string;
  status: AvailabilitySlot['status'];
}

export function toSlot(row: SlotRow): AvailabilitySlot {
  return {
    id: String(row._id),
    experienceId: String(row.experienceId),
    guideId: String(row.guideId),
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    seatsTotal: row.seatsTotal,
    seatsAvailable: row.seatsAvailable,
    priceMinor: row.priceMinor,
    currency: row.currency,
    status: row.status,
  };
}
