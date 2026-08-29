import { type AiCandidate } from '../../infra/ai';

/**
 * The system prompt states the product rule the model must not break: it may
 * only cite ids from the supplied list. The guard enforces it regardless, but
 * saying it plainly makes the model comply far more often.
 */
export const DISCOVERY_SYSTEM = `You are Anvesh, an Indian local-first travel discovery assistant.

Hard rules you must never break:
1. You may ONLY reference places from the CANDIDATES list given to you. Never invent a place, and never use an id that is not in the list.
2. Popularity is a negative: prefer quiet, locally owned, authentic places over famous ones.
3. Be concrete and factual. Use only the details present in the candidate data.
4. Never promise opening hours, prices or availability that are not in the data.
5. Reply with JSON only, matching the given schema exactly.`;

export const ITINERARY_SYSTEM = `You are Anvesh, planning a day-by-day itinerary in India.

Hard rules you must never break:
1. Every activity of kind PLACE must use a placeId from the CANDIDATES list. Never invent one.
2. Prefer low-crowd places and spread travel sensibly; do not stack the busiest stops together.
3. Keep each day realistic: at most four activities, and account for the stated duration of each place.
4. Reply with JSON only, matching the given schema exactly.`;

export const EXPLAIN_SYSTEM = `You are Anvesh, explaining one Indian place to a traveller.
Use only the supplied facts about that place. Do not invent history, prices or timings.
If you do not know something, leave the field empty. Reply with JSON only.`;

export function renderCandidates(candidates: AiCandidate[]): string {
  if (candidates.length === 0) return 'CANDIDATES: (none)';
  const rows = candidates.map(
    (c) =>
      `- id=${c.id} | ${c.title} | ${c.city}, ${c.state} | categories=${c.categories.join('/')} | crowd=${c.crowdLevel.toFixed(2)} | popularity=${c.popularity.toFixed(2)} | rating=${c.ratingAvg} | entryFeePaise=${c.entryFeeMinor} | typicalMinutes=${c.durationMin} | ${c.summary}`,
  );
  return `CANDIDATES (the only places you may reference):\n${rows.join('\n')}`;
}

export const DISCOVERY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    placeIds: { type: 'array', items: { type: 'string' } },
    highlights: {
      type: 'array',
      items: {
        type: 'object',
        properties: { placeId: { type: 'string' }, why: { type: 'string' } },
        required: ['placeId', 'why'],
      },
    },
    followUps: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'placeIds', 'highlights', 'followUps'],
} as const;

export const ITINERARY_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dayNumber: { type: 'integer' },
          title: { type: 'string' },
          activities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['PLACE', 'EXPERIENCE', 'NOTE'] },
                placeId: { type: 'string' },
                experienceId: { type: 'string' },
                title: { type: 'string' },
                note: { type: 'string' },
                startTimeMin: { type: 'integer' },
                durationMin: { type: 'integer' },
              },
              required: ['kind', 'title'],
            },
          },
        },
        required: ['dayNumber', 'title', 'activities'],
      },
    },
  },
  required: ['title', 'summary', 'days'],
} as const;

export const EXPLAIN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    bestTime: { type: 'string' },
    gettingThere: { type: 'string' },
    respectfulTravelTips: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary'],
} as const;
