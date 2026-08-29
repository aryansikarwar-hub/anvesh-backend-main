import { describe, expect, it } from 'vitest';
import { aiDiscoveryOutputSchema, aiItineraryOutputSchema } from '../../lib/validation';
import { guardAiOutput, stripCodeFence } from './ai.guard';
import { AppError } from '../../common/api-error';
import { StubAiProvider } from '../../infra/ai/stub.provider';
import { DISCOVERY_JSON_SCHEMA, ITINERARY_JSON_SCHEMA } from './ai.prompts';

const REAL_A = '65f1c2d3e4b5a60718293a4b';
const REAL_B = '65f1c2d3e4b5a60718293a4c';
const GHOST = '65f1c2d3e4b5a60718293aff';

const resolver = async () => ({
  knownPlaceIds: new Set([REAL_A, REAL_B]),
  knownExperienceIds: new Set<string>(),
});

const extractDiscoveryRefs = (value: { placeIds: string[]; highlights: { placeId: string }[] }) => ({
  placeIds: [...value.placeIds, ...value.highlights.map((h) => h.placeId)],
  experienceIds: [],
});

describe('AI output guard', () => {
  it('accepts an output that only cites real ids', async () => {
    const raw = JSON.stringify({
      answer: 'Two quiet options.',
      placeIds: [REAL_A, REAL_B],
      highlights: [{ placeId: REAL_A, why: 'Rarely crowded' }],
      followUps: [],
    });
    const guarded = await guardAiOutput(raw, aiDiscoveryOutputSchema, extractDiscoveryRefs, resolver);
    expect(guarded.value.placeIds).toEqual([REAL_A, REAL_B]);
  });

  it('REJECTS an output that invents a place id', async () => {
    const raw = JSON.stringify({
      answer: 'Try this hidden waterfall.',
      placeIds: [REAL_A, GHOST],
      highlights: [],
      followUps: [],
    });
    await expect(
      guardAiOutput(raw, aiDiscoveryOutputSchema, extractDiscoveryRefs, resolver),
    ).rejects.toMatchObject({ code: 'AI_HALLUCINATED_REFERENCE' });
  });

  it('REJECTS a hallucinated id hidden inside highlights', async () => {
    const raw = JSON.stringify({
      answer: 'One option.',
      placeIds: [REAL_A],
      highlights: [{ placeId: GHOST, why: 'Secret spot nobody knows' }],
      followUps: [],
    });
    await expect(
      guardAiOutput(raw, aiDiscoveryOutputSchema, extractDiscoveryRefs, resolver),
    ).rejects.toMatchObject({ code: 'AI_HALLUCINATED_REFERENCE' });
  });

  it('rejects output that is not JSON at all', async () => {
    await expect(
      guardAiOutput('I would suggest Coorg!', aiDiscoveryOutputSchema, extractDiscoveryRefs, resolver),
    ).rejects.toMatchObject({ code: 'AI_OUTPUT_INVALID' });
  });

  it('rejects output that breaks the schema', async () => {
    const raw = JSON.stringify({ answer: 'x', placeIds: 'not-an-array', highlights: [] });
    await expect(
      guardAiOutput(raw, aiDiscoveryOutputSchema, extractDiscoveryRefs, resolver),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a place name used where an id belongs', async () => {
    const raw = JSON.stringify({
      answer: 'x',
      placeIds: ['bandaje-arbi-falls'],
      highlights: [],
      followUps: [],
    });
    await expect(
      guardAiOutput(raw, aiDiscoveryOutputSchema, extractDiscoveryRefs, resolver),
    ).rejects.toMatchObject({ code: 'AI_OUTPUT_INVALID' });
  });

  it('unwraps a markdown code fence', () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe('stub provider', () => {
  const provider = new StubAiProvider();
  const candidates = [
    {
      id: REAL_A,
      title: 'Bandaje Arbi Falls',
      city: 'Ujire',
      state: 'Karnataka',
      categories: ['waterfall', 'trek'],
      summary: 'A steep trek to a wide falls.',
      crowdLevel: 0.15,
      popularity: 0.2,
      ratingAvg: 4.6,
      entryFeeMinor: 30000,
      durationMin: 480,
    },
    {
      id: REAL_B,
      title: 'Kaas Plateau',
      city: 'Satara',
      state: 'Maharashtra',
      categories: ['monsoon'],
      summary: 'Flowering plateau.',
      crowdLevel: 0.85,
      popularity: 0.75,
      ratingAvg: 4.2,
      entryFeeMinor: 15000,
      durationMin: 180,
    },
  ];

  it('produces schema-valid discovery output that only cites supplied ids', async () => {
    const result = await provider.complete({
      system: 's',
      user: 'quiet waterfall trek',
      jsonSchema: DISCOVERY_JSON_SCHEMA as unknown as Record<string, unknown>,
      candidates,
    });
    const guarded = await guardAiOutput(
      result.text,
      aiDiscoveryOutputSchema,
      extractDiscoveryRefs,
      resolver,
    );
    expect(guarded.value.placeIds.every((id) => [REAL_A, REAL_B].includes(id))).toBe(true);
  });

  it('ranks the quiet place above the crowded one', async () => {
    const result = await provider.complete({
      system: 's',
      user: 'somewhere to walk',
      jsonSchema: DISCOVERY_JSON_SCHEMA as unknown as Record<string, unknown>,
      candidates,
    });
    const parsed = JSON.parse(result.text) as { placeIds: string[] };
    expect(parsed.placeIds[0]).toBe(REAL_A);
  });

  it('produces schema-valid itinerary output', async () => {
    const result = await provider.complete({
      system: 's',
      user: 'plan 2 days',
      jsonSchema: ITINERARY_JSON_SCHEMA as unknown as Record<string, unknown>,
      candidates,
    });
    const guarded = await guardAiOutput(
      result.text,
      aiItineraryOutputSchema,
      (value) => ({
        placeIds: value.days.flatMap((d) =>
          d.activities.map((a) => a.placeId).filter((id): id is string => Boolean(id)),
        ),
        experienceIds: [],
      }),
      resolver,
    );
    expect(guarded.value.days.length).toBeGreaterThan(0);
  });

  it('never returns an id it was not given', async () => {
    const result = await provider.complete({
      system: 's',
      user: 'anything',
      jsonSchema: DISCOVERY_JSON_SCHEMA as unknown as Record<string, unknown>,
      candidates: [],
    });
    const parsed = JSON.parse(result.text) as { placeIds: string[] };
    expect(parsed.placeIds).toEqual([]);
  });
});
