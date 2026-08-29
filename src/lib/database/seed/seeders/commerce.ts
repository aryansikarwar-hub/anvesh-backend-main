import { applyBasisPoints } from '../../../shared';
import { AvailabilitySlotModel, ExperienceModel } from '../../models';
import { EXPERIENCE_SEEDS } from '../data/experiences';
import { seedId, type SeedContext } from '../context';

const COMMISSION_BPS = 1200;
const SLOT_DAYS_AHEAD = 45;

/**
 * Generates future slots for every seeded experience.
 *
 * Slots are the only seeded commerce data. No seeded bookings or payments are
 * created: a booking that was never paid for through a verified Razorpay
 * signature would be exactly the kind of fake state the spec forbids. Use the
 * running app (or the integration tests) to create bookings.
 */
export async function seedAvailability(ctx: SeedContext): Promise<void> {
  let created = 0;

  for (const e of EXPERIENCE_SEEDS) {
    const experience = await ExperienceModel.findById(seedId(`experience:${e.slug}`)).lean();
    if (!experience) continue;

    // Long multi-day experiences get weekly departures; day trips get more.
    const isMultiDay = e.durationMin > 1440;
    const stride = isMultiDay ? 7 : 2;

    for (let dayOffset = 3; dayOffset <= SLOT_DAYS_AHEAD; dayOffset += stride) {
      const startAt = new Date(ctx.now.getTime() + dayOffset * 86_400_000);
      startAt.setUTCHours(1, 0, 0, 0); // 06:30 IST
      const endAt = new Date(startAt.getTime() + e.durationMin * 60_000);

      await AvailabilitySlotModel.updateOne(
        { _id: seedId(`slot:${e.slug}:${dayOffset}`) },
        {
          $set: {
            experienceId: experience._id,
            guideId: experience.guideId,
            startAt,
            endAt,
            timezone: 'Asia/Kolkata',
            seatsTotal: e.maxSeats,
            priceMinor: e.basePriceMinor,
            currency: 'INR',
            status: 'OPEN',
            deletedAt: null,
          },
          $setOnInsert: { seatsAvailable: e.maxSeats, seatsHeld: 0 },
        },
        { upsert: true },
      );
      created += 1;
    }
  }

  ctx.log(`availability slots: ${created}`);
}

/** Documents the commission split the API applies, so seed and runtime agree. */
export function splitBookingAmounts(subtotalMinor: number) {
  const commissionMinor = applyBasisPoints(subtotalMinor, COMMISSION_BPS);
  return {
    subtotalMinor,
    commissionMinor,
    guidePayoutMinor: subtotalMinor - commissionMinor,
  };
}
