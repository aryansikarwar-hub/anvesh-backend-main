import { Types } from 'mongoose';
import { MAX_ACTIVITIES_PER_DAY, MAX_TRIP_DAYS } from '../../lib/database';
import { buildPageInfo, toSkipLimit } from '../../lib/shared';
import { ERROR_CODES, type Paginated, type Trip } from '../../lib/types';
import { type TripActivityInput, type TripCreateInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { DestinationModel } from '../../lib/database';
import { type ExperienceRepository } from '../experiences/experience.repository';
import { type PlaceRepository } from '../places/place.repository';
import { MAX_TRIPS_PER_USER, type TripRepository } from './trip.repository';
import { toTrip } from './trip.mapper';

/**
 * The trip planner.
 *
 * Every PLACE or EXPERIENCE activity is resolved against the database before
 * it is stored, so a trip can never contain an id that does not exist — the
 * same rule the AI itinerary path relies on.
 */
export class TripService {
  constructor(
    private readonly repo: TripRepository,
    private readonly places: PlaceRepository,
    private readonly experiences: ExperienceRepository,
  ) {}

  async create(userId: string, input: TripCreateInput): Promise<Trip> {
    if ((await this.repo.countForUser(userId)) >= MAX_TRIPS_PER_USER) {
      throw new AppError(ERROR_CODES.TRIP_LIMIT_REACHED, {
        details: { limit: MAX_TRIPS_PER_USER },
      });
    }

    let destinationName: string | null = null;
    if (input.destinationId) {
      const destination = await DestinationModel.findById(input.destinationId).lean().exec();
      if (!destination) throw new AppError(ERROR_CODES.DESTINATION_NOT_FOUND);
      destinationName = destination.name;
    }

    const created = await this.repo.create({
      userId: new Types.ObjectId(userId),
      title: input.title,
      destinationId: input.destinationId ? new Types.ObjectId(input.destinationId) : null,
      destinationName,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      travellers: input.travellers,
      notes: input.notes,
      days: [],
    });
    return toTrip(created);
  }

  async list(
    userId: string,
    options: { page: number; limit: number; destinationId?: string },
  ): Promise<Paginated<Trip>> {
    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const { items, total } = await this.repo.listForUser(
      userId,
      skip,
      limit,
      options.destinationId,
    );
    return {
      items: items.map((i) => toTrip(i as never)),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }

  async get(userId: string, tripId: string): Promise<Trip> {
    const trip = await this.repo.findOwned(userId, tripId);
    if (!trip) throw new AppError(ERROR_CODES.TRIP_NOT_FOUND);
    return toTrip(trip);
  }

  async update(userId: string, tripId: string, patch: Partial<TripCreateInput>): Promise<Trip> {
    const set: Record<string, unknown> = {};
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.travellers !== undefined) set.travellers = patch.travellers;
    if (patch.notes !== undefined) set.notes = patch.notes;
    if (patch.startDate !== undefined) set.startDate = patch.startDate ? new Date(patch.startDate) : null;
    if (patch.endDate !== undefined) set.endDate = patch.endDate ? new Date(patch.endDate) : null;
    if (patch.destinationId !== undefined) {
      if (patch.destinationId) {
        const destination = await DestinationModel.findById(patch.destinationId).lean().exec();
        if (!destination) throw new AppError(ERROR_CODES.DESTINATION_NOT_FOUND);
        set.destinationId = destination._id;
        set.destinationName = destination.name;
      } else {
        set.destinationId = null;
        set.destinationName = null;
      }
    }

    const updated = await this.repo.updateOwned(userId, tripId, { $set: set });
    if (!updated) throw new AppError(ERROR_CODES.TRIP_NOT_FOUND);
    return toTrip(updated);
  }

  async remove(userId: string, tripId: string): Promise<void> {
    const deleted = await this.repo.softDeleteOwned(userId, tripId);
    if (!deleted) throw new AppError(ERROR_CODES.TRIP_NOT_FOUND);
  }

  async addDay(userId: string, tripId: string, input: { title: string; date: string | null }) {
    const trip = await this.requireTrip(userId, tripId);
    if (trip.days.length >= MAX_TRIP_DAYS) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, {
        message: `A trip can hold at most ${MAX_TRIP_DAYS} days.`,
      });
    }
    trip.days.push({
      _id: new Types.ObjectId(),
      dayNumber: trip.days.length + 1,
      date: input.date ? new Date(input.date) : null,
      title: input.title,
      activities: [],
    });
    await trip.save();
    return toTrip(trip);
  }

  async updateDay(
    userId: string,
    tripId: string,
    dayId: string,
    patch: { title?: string; date?: string | null },
  ) {
    const trip = await this.requireTrip(userId, tripId);
    const day = trip.days.find((d) => String(d._id) === dayId);
    if (!day) throw new AppError(ERROR_CODES.TRIP_DAY_NOT_FOUND);
    if (patch.title !== undefined) day.title = patch.title;
    if (patch.date !== undefined) day.date = patch.date ? new Date(patch.date) : null;
    await trip.save();
    return toTrip(trip);
  }

  async removeDay(userId: string, tripId: string, dayId: string) {
    const trip = await this.requireTrip(userId, tripId);
    const before = trip.days.length;
    trip.days = trip.days.filter((d) => String(d._id) !== dayId);
    if (trip.days.length === before) throw new AppError(ERROR_CODES.TRIP_DAY_NOT_FOUND);
    trip.days.forEach((day, index) => {
      day.dayNumber = index + 1;
    });
    await trip.save();
    return toTrip(trip);
  }

  async addActivity(userId: string, tripId: string, dayId: string, input: TripActivityInput) {
    const trip = await this.requireTrip(userId, tripId);
    const day = trip.days.find((d) => String(d._id) === dayId);
    if (!day) throw new AppError(ERROR_CODES.TRIP_DAY_NOT_FOUND);
    if (day.activities.length >= MAX_ACTIVITIES_PER_DAY) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, {
        message: `A day can hold at most ${MAX_ACTIVITIES_PER_DAY} activities.`,
      });
    }

    const resolved = await this.resolveActivity(input);
    day.activities.push({
      _id: new Types.ObjectId(),
      ...resolved,
      order: day.activities.length,
    });
    await trip.save();
    return toTrip(trip);
  }

  async removeActivity(userId: string, tripId: string, dayId: string, activityId: string) {
    const trip = await this.requireTrip(userId, tripId);
    const day = trip.days.find((d) => String(d._id) === dayId);
    if (!day) throw new AppError(ERROR_CODES.TRIP_DAY_NOT_FOUND);
    const before = day.activities.length;
    day.activities = day.activities.filter((a) => String(a._id) !== activityId);
    if (day.activities.length === before) throw new AppError(ERROR_CODES.TRIP_ACTIVITY_NOT_FOUND);
    day.activities.forEach((activity, index) => {
      activity.order = index;
    });
    await trip.save();
    return toTrip(trip);
  }

  /** Reorder takes the complete ordered list; a partial list is rejected. */
  async reorderActivities(
    userId: string,
    tripId: string,
    dayId: string,
    activityIds: string[],
  ) {
    const trip = await this.requireTrip(userId, tripId);
    const day = trip.days.find((d) => String(d._id) === dayId);
    if (!day) throw new AppError(ERROR_CODES.TRIP_DAY_NOT_FOUND);

    const existing = new Set(day.activities.map((a) => String(a._id)));
    if (activityIds.length !== existing.size || activityIds.some((id) => !existing.has(id))) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, {
        message: 'Send every activity id for the day, in the new order.',
      });
    }

    const order = new Map(activityIds.map((id, index) => [id, index]));
    day.activities.forEach((activity) => {
      activity.order = order.get(String(activity._id)) ?? activity.order;
    });
    day.activities.sort((a, b) => a.order - b.order);
    await trip.save();
    return toTrip(trip);
  }

  private async resolveActivity(input: TripActivityInput) {
    if (input.kind === 'PLACE') {
      const place = await this.places.findPublishedById(input.placeId as string);
      if (!place) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);
      return {
        kind: 'PLACE' as const,
        placeId: place._id,
        experienceId: null,
        title: input.title || place.title,
        note: input.note,
        startTimeMin: input.startTimeMin,
        durationMin: input.durationMin,
        location: place.location,
      };
    }
    if (input.kind === 'EXPERIENCE') {
      const experience = await this.experiences.findPublishedById(input.experienceId as string);
      if (!experience) throw new AppError(ERROR_CODES.EXPERIENCE_NOT_FOUND);
      return {
        kind: 'EXPERIENCE' as const,
        placeId: null,
        experienceId: experience._id,
        title: input.title || experience.title,
        note: input.note,
        startTimeMin: input.startTimeMin,
        durationMin: input.durationMin,
        location: experience.meetingPoint.location,
      };
    }
    return {
      kind: 'NOTE' as const,
      placeId: null,
      experienceId: null,
      title: input.title,
      note: input.note,
      startTimeMin: input.startTimeMin,
      durationMin: input.durationMin,
      location: null,
    };
  }

  private async requireTrip(userId: string, tripId: string) {
    const trip = await this.repo.findOwned(userId, tripId);
    if (!trip) throw new AppError(ERROR_CODES.TRIP_NOT_FOUND);
    return trip;
  }
}
