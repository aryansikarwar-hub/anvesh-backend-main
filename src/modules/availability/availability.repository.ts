import { Types, type ClientSession } from 'mongoose';
import { AvailabilitySlotModel, type AvailabilitySlotDocument } from '../../lib/database';

export class AvailabilityRepository {
  async listPublic(experienceId: string, from: Date, to: Date) {
    return AvailabilitySlotModel.find({
      experienceId: new Types.ObjectId(experienceId),
      status: 'OPEN',
      startAt: { $gte: from, $lte: to },
    })
      .sort({ startAt: 1 })
      .lean()
      .exec();
  }

  async findOpenById(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return AvailabilitySlotModel.findOne({ _id: new Types.ObjectId(id) }).lean().exec();
  }

  async createMany(documents: Record<string, unknown>[]) {
    return AvailabilitySlotModel.insertMany(documents, { ordered: false });
  }

  async create(document: Record<string, unknown>): Promise<AvailabilitySlotDocument> {
    const [created] = await AvailabilitySlotModel.create([document]);
    return created as AvailabilitySlotDocument;
  }

  async listOwned(guideId: string, filter: Record<string, unknown>, skip: number, limit: number) {
    const query = { ...filter, guideId: new Types.ObjectId(guideId) };
    const [items, total] = await Promise.all([
      AvailabilitySlotModel.find(query).sort({ startAt: 1 }).skip(skip).limit(limit).lean().exec(),
      AvailabilitySlotModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  async findOwned(guideId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return AvailabilitySlotModel.findOne({
      _id: new Types.ObjectId(id),
      guideId: new Types.ObjectId(guideId),
    }).exec();
  }

  async updateOwned(guideId: string, id: string, update: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(id)) return null;
    return AvailabilitySlotModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), guideId: new Types.ObjectId(guideId) },
      update,
      { new: true, runValidators: true },
    ).exec();
  }

  /**
   * THE booking concurrency primitive.
   *
   * One atomic conditional update: the seats are only decremented if the slot
   * is still OPEN and still has at least `seats` available. A null result means
   * somebody else won the race, and the caller reports SLOT_SOLD_OUT. There is
   * no application-level lock anywhere in this path — by design.
   */
  async reserveSeats(
    slotId: Types.ObjectId,
    seats: number,
    session?: ClientSession,
  ): Promise<AvailabilitySlotDocument | null> {
    return AvailabilitySlotModel.findOneAndUpdate(
      {
        _id: slotId,
        deletedAt: null,
        status: 'OPEN',
        startAt: { $gt: new Date() },
        seatsAvailable: { $gte: seats },
      },
      { $inc: { seatsAvailable: -seats } },
      { new: true, ...(session ? { session } : {}) },
    ).exec();
  }

  /** Returns seats to the pool, never above seatsTotal. */
  async releaseSeats(
    slotId: Types.ObjectId,
    seats: number,
    session?: ClientSession,
  ): Promise<void> {
    const slot = await AvailabilitySlotModel.findById(slotId)
      .session(session ?? null)
      .exec();
    if (!slot) return;
    const restored = Math.min(slot.seatsTotal, slot.seatsAvailable + seats);
    await AvailabilitySlotModel.updateOne(
      { _id: slotId },
      { $set: { seatsAvailable: restored } },
      session ? { session } : {},
    ).exec();
  }

  async hasBookings(slotId: Types.ObjectId): Promise<boolean> {
    const slot = await AvailabilitySlotModel.findById(slotId).lean().exec();
    if (!slot) return false;
    return slot.seatsAvailable < slot.seatsTotal;
  }

  async overlaps(experienceId: Types.ObjectId, startAt: Date, endAt: Date): Promise<boolean> {
    return Boolean(
      await AvailabilitySlotModel.exists({
        experienceId,
        status: { $ne: 'CANCELLED' },
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      }),
    );
  }
}
