import { type Request, type Response } from 'express';
import { sendOk } from '../../common/envelope';
import { body } from '../../common/middleware/validate';
import { type AiService } from './ai.service';
import { type TripService } from '../trips/trip.service';

export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly trips: TripService,
  ) {}

  discover = async (req: Request, res: Response): Promise<void> => {
    const input = body<{
      prompt: string;
      lng?: number;
      lat?: number;
      radiusKm: number;
      limit: number;
    }>(req);
    sendOk(res, {
      result: await this.ai.discover(input, { userId: req.auth?.userId ?? null }),
    });
  };

  itinerary = async (req: Request, res: Response): Promise<void> => {
    const input = body<{
      destinationId: string | null;
      city?: string;
      days: number;
      travellers: number;
      interests: string[];
      pace: string;
      avoidCrowds: boolean;
      saveAsTrip: boolean;
    }>(req);
    const userId = req.auth?.userId ?? null;

    const itinerary = await this.ai.itinerary(input, { userId });

    // Saving writes through the ordinary trip service, which re-resolves every
    // place id against the database a second time.
    if (input.saveAsTrip && userId) {
      const trip = await this.trips.create(userId, {
        title: itinerary.title,
        destinationId: input.destinationId,
        startDate: null,
        endDate: null,
        travellers: input.travellers,
        notes: itinerary.summary,
      });
      let saved = trip;
      for (const day of itinerary.days) {
        saved = await this.trips.addDay(userId, trip.id, { title: day.title, date: null });
        const created = saved.days[saved.days.length - 1];
        if (!created) continue;
        for (const activity of day.activities) {
          saved = await this.trips.addActivity(userId, trip.id, created.id, {
            kind: activity.kind,
            ...(activity.placeId ? { placeId: activity.placeId } : {}),
            ...(activity.experienceId ? { experienceId: activity.experienceId } : {}),
            title: activity.title,
            note: activity.note,
            startTimeMin: activity.startTimeMin,
            durationMin: activity.durationMin,
          });
        }
      }
      sendOk(res, { itinerary, trip: saved });
      return;
    }

    sendOk(res, { itinerary, trip: null });
  };

  /** Lets the UI show honestly which provider answered. */
  status = async (_req: Request, res: Response): Promise<void> => {
    sendOk(res, { provider: this.ai.providerInfo });
  };
}
