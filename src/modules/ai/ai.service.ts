import { Types } from 'mongoose';
import { AiRequestLogModel, ExperienceModel, PlaceModel } from '../../lib/database';
import { type Env } from '../../lib/config';
import {
  ERROR_CODES,
  type AiDiscoveryResult,
  type AiItineraryResult,
  type AiProviderInfo,
  type AiTask,
} from '../../lib/types';
import {
  aiDiscoveryOutputSchema,
  aiItineraryOutputSchema,
  type AiDiscoveryOutput,
  type AiItineraryOutput,
} from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { getRequestId } from '../../common/request-context';
import { type AiCandidate, type AiProvider } from '../../infra/ai';
import { type DiscoveryRepository } from '../discovery/discovery.repository';
import { guardAiOutput, type ReferenceCheck } from './ai.guard';
import {
  DISCOVERY_JSON_SCHEMA,
  DISCOVERY_SYSTEM,
  ITINERARY_JSON_SCHEMA,
  ITINERARY_SYSTEM,
  renderCandidates,
} from './ai.prompts';

export interface AiActor {
  userId: string | null;
}

const MAX_CANDIDATES = 40;

/**
 * AI features.
 *
 * The pattern is the same for every task: fetch a real candidate set from
 * MongoDB, hand the model only those, then refuse anything it says that does
 * not resolve back to those documents.
 */
export class AiService {
  constructor(
    private readonly provider: AiProvider,
    private readonly discovery: DiscoveryRepository,
    private readonly env: Env,
  ) {}

  get providerInfo(): AiProviderInfo {
    return {
      provider: this.provider.name,
      model: this.provider.model,
      degraded: this.provider.name === 'stub',
    };
  }

  async discover(
    input: { prompt: string; lng?: number; lat?: number; radiusKm: number; limit: number },
    actor: AiActor,
  ): Promise<AiDiscoveryResult> {
    const candidates = await this.loadCandidates(input);
    const startedAt = Date.now();

    const completion = await this.run('DISCOVER', actor, async () =>
      this.provider.complete({
        system: DISCOVERY_SYSTEM,
        user: `${renderCandidates(candidates)}\n\nTRAVELLER ASKS: ${input.prompt}\n\nPick at most ${input.limit} places.`,
        jsonSchema: DISCOVERY_JSON_SCHEMA as unknown as Record<string, unknown>,
        candidates,
      }),
    );

    const guarded = await guardAiOutput<AiDiscoveryOutput>(
      completion.text,
      aiDiscoveryOutputSchema,
      (value) => ({
        placeIds: [...value.placeIds, ...value.highlights.map((h) => h.placeId)],
        experienceIds: [],
      }),
      (refs) => this.resolveReferences(refs),
    ).catch(async (error: unknown) => {
      await this.log('DISCOVER', actor, completion, Date.now() - startedAt, error);
      throw error;
    });

    await this.log('DISCOVER', actor, completion, Date.now() - startedAt, null);

    return {
      answer: guarded.value.answer,
      placeIds: guarded.value.placeIds,
      highlights: guarded.value.highlights,
      followUps: guarded.value.followUps,
      provider: this.providerInfo,
    };
  }

  async itinerary(
    input: {
      city?: string;
      destinationId: string | null;
      days: number;
      interests: string[];
      avoidCrowds: boolean;
      pace: string;
    },
    actor: AiActor,
  ): Promise<AiItineraryResult> {
    const candidates = await this.loadCandidates({
      prompt: `${input.city ?? ''} ${input.interests.join(' ')}`,
      radiusKm: 200,
      limit: MAX_CANDIDATES,
      ...(input.city ? { city: input.city } : {}),
      ...(input.destinationId ? { destinationId: input.destinationId } : {}),
      ...(input.avoidCrowds ? { maxCrowd: 0.6 } : {}),
    });

    if (candidates.length === 0) {
      throw new AppError(ERROR_CODES.NOT_FOUND, {
        message: 'There are no places in Anvesh for that area yet, so no itinerary can be built.',
      });
    }

    const startedAt = Date.now();
    const completion = await this.run('ITINERARY', actor, async () =>
      this.provider.complete({
        system: ITINERARY_SYSTEM,
        user: `${renderCandidates(candidates)}\n\nPlan ${input.days} day(s) around ${input.city ?? 'the destination'}. Interests: ${input.interests.join(', ') || 'general'}. Pace: ${input.pace}. Avoid crowds: ${input.avoidCrowds}.`,
        jsonSchema: ITINERARY_JSON_SCHEMA as unknown as Record<string, unknown>,
        candidates,
        maxOutputTokens: 3072,
      }),
    );

    const guarded = await guardAiOutput<AiItineraryOutput>(
      completion.text,
      aiItineraryOutputSchema,
      (value) => ({
        placeIds: value.days.flatMap((day) =>
          day.activities.map((a) => a.placeId).filter((id): id is string => Boolean(id)),
        ),
        experienceIds: value.days.flatMap((day) =>
          day.activities.map((a) => a.experienceId).filter((id): id is string => Boolean(id)),
        ),
      }),
      (refs) => this.resolveReferences(refs),
    ).catch(async (error: unknown) => {
      await this.log('ITINERARY', actor, completion, Date.now() - startedAt, error);
      throw error;
    });

    await this.log('ITINERARY', actor, completion, Date.now() - startedAt, null);

    return {
      title: guarded.value.title,
      summary: guarded.value.summary,
      days: guarded.value.days.map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        activities: day.activities.map((a) => ({
          kind: a.kind,
          ...(a.placeId ? { placeId: a.placeId } : {}),
          ...(a.experienceId ? { experienceId: a.experienceId } : {}),
          title: a.title,
          note: a.note,
          startTimeMin: a.startTimeMin,
          durationMin: a.durationMin,
        })),
      })),
      provider: this.providerInfo,
    };
  }

  /** Loads real, published places as the only material the model may cite. */
  private async loadCandidates(input: {
    prompt: string;
    lng?: number;
    lat?: number;
    radiusKm: number;
    limit: number;
    city?: string;
    destinationId?: string;
    maxCrowd?: number;
  }): Promise<AiCandidate[]> {
    const filter = {
      ...(input.city ? { city: input.city } : {}),
      ...(input.destinationId ? { destinationId: input.destinationId } : {}),
      ...(typeof input.maxCrowd === 'number' ? { maxCrowd: input.maxCrowd } : {}),
    };

    const docs =
      typeof input.lng === 'number' && typeof input.lat === 'number'
        ? await this.discovery.findNear(input.lng, input.lat, input.radiusKm, filter, MAX_CANDIDATES)
        : ((await this.discovery.findByText(input.prompt.slice(0, 120), filter, MAX_CANDIDATES))
            .length > 0
            ? await this.discovery.findByText(input.prompt.slice(0, 120), filter, MAX_CANDIDATES)
            : await this.discovery.findCandidates(filter, MAX_CANDIDATES));

    return docs.map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      city: String(doc.address.city ?? ''),
      state: String(doc.address.state ?? ''),
      categories: doc.categorySlugs,
      summary: doc.summary,
      crowdLevel: doc.signals.crowdLevel,
      popularity: doc.signals.popularityScore,
      ratingAvg: doc.signals.ratingAvg,
      entryFeeMinor: doc.details.entryFeeMinor,
      durationMin: doc.details.durationMin,
    }));
  }

  private async resolveReferences(refs: ReferenceCheck) {
    const placeIds = refs.placeIds.filter((id) => Types.ObjectId.isValid(id));
    const experienceIds = refs.experienceIds.filter((id) => Types.ObjectId.isValid(id));

    const [places, experiences] = await Promise.all([
      placeIds.length
        ? PlaceModel.find({ _id: { $in: placeIds }, status: 'PUBLISHED' }).select('_id').lean().exec()
        : [],
      experienceIds.length
        ? ExperienceModel.find({ _id: { $in: experienceIds }, status: 'PUBLISHED' })
            .select('_id')
            .lean()
            .exec()
        : [],
    ]);

    return {
      knownPlaceIds: new Set(places.map((p) => String(p._id))),
      knownExperienceIds: new Set(experiences.map((e) => String(e._id))),
    };
  }

  private async run<T>(_task: AiTask, actor: AiActor, fn: () => Promise<T>): Promise<T> {
    if (!this.provider.available) {
      throw new AppError(ERROR_CODES.AI_PROVIDER_NOT_CONFIGURED);
    }
    await this.assertQuota(actor);
    return fn();
  }

  private async assertQuota(actor: AiActor): Promise<void> {
    if (!actor.userId) return;
    const since = new Date(Date.now() - 30 * 86_400_000);
    const used = await AiRequestLogModel.countDocuments({
      userId: new Types.ObjectId(actor.userId),
      createdAt: { $gte: since },
    }).exec();
    if (used >= this.env.AI_MONTHLY_REQUEST_LIMIT) {
      throw new AppError(ERROR_CODES.AI_QUOTA_EXCEEDED, {
        details: { limit: this.env.AI_MONTHLY_REQUEST_LIMIT },
      });
    }
  }

  private async log(
    task: AiTask,
    actor: AiActor,
    completion: { promptTokens: number; completionTokens: number },
    latencyMs: number,
    error: unknown,
  ): Promise<void> {
    const verdict = !error
      ? 'OK'
      : error instanceof AppError && error.code === ERROR_CODES.AI_HALLUCINATED_REFERENCE
        ? 'REFERENCE_REJECTED'
        : error instanceof AppError && error.code === ERROR_CODES.AI_OUTPUT_INVALID
          ? 'SCHEMA_REJECTED'
          : 'PROVIDER_ERROR';

    await AiRequestLogModel.create([
      {
        userId: actor.userId ? new Types.ObjectId(actor.userId) : null,
        task,
        provider: this.provider.name,
        model: this.provider.model,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        latencyMs,
        verdict,
        rejectionDetail: error instanceof Error ? error.message.slice(0, 500) : null,
        requestId: getRequestId(),
      },
    ]).catch(() => undefined);
  }
}
