import { createHash } from 'node:crypto';
import {
  type AiCandidate,
  type AiCompletionRequest,
  type AiCompletionResult,
  type AiProvider,
} from './ai-provider';

/**
 * Deterministic offline provider, selected only when AI_PROVIDER=stub.
 *
 * It is NOT a language model and it does not pretend to be one. It ranks the
 * real database candidates it was handed and writes a short, factual answer
 * from their own fields. Because it can only ever cite ids from that list, it
 * is structurally incapable of inventing a place.
 *
 * Every response it produces is labelled provider:"stub" all the way to the UI,
 * and `parseConfig` refuses to boot production with this provider selected.
 */
export class StubAiProvider implements AiProvider {
  readonly name = 'stub';
  readonly model = 'anvesh-local-rules-v1';
  readonly available = true;

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const kind = detectKind(request.jsonSchema);
    const ranked = rankQuietFirst(request.candidates, request.user);
    const text =
      kind === 'itinerary'
        ? JSON.stringify(buildItinerary(ranked, request.user))
        : JSON.stringify(buildDiscovery(ranked, request.user));

    return {
      text,
      promptTokens: Math.ceil((request.system.length + request.user.length) / 4),
      completionTokens: Math.ceil(text.length / 4),
    };
  }
}

function detectKind(schema: Record<string, unknown>): 'itinerary' | 'discovery' {
  const properties = (schema.properties ?? {}) as Record<string, unknown>;
  return 'days' in properties ? 'itinerary' : 'discovery';
}

/** Quiet, local, well-rated first — the same priorities as the real ranker. */
function rankQuietFirst(candidates: AiCandidate[], prompt: string): AiCandidate[] {
  const words = prompt.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  return [...candidates]
    .map((candidate) => {
      const haystack = `${candidate.title} ${candidate.summary} ${candidate.city} ${candidate.categories.join(' ')}`.toLowerCase();
      const overlap = words.filter((word) => haystack.includes(word)).length / Math.max(1, words.length);
      const score =
        overlap * 1.2 + candidate.ratingAvg / 5 - candidate.crowdLevel * 0.9 - candidate.popularity * 1.1;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);
}

function buildDiscovery(ranked: AiCandidate[], prompt: string) {
  const picks = ranked.slice(0, 6);
  return {
    answer:
      picks.length === 0
        ? 'Nothing in the database matches that yet. Try a wider area or a different category.'
        : `Based on what is in Anvesh right now, these ${picks.length} places fit "${prompt.slice(0, 80)}" and stay away from the busiest spots.`,
    placeIds: picks.map((p) => p.id),
    highlights: picks.map((p) => ({
      placeId: p.id,
      why: `${p.title} in ${p.city}, ${p.state} — ${describeCrowd(p.crowdLevel)}, about ${Math.round(p.durationMin / 60)}h.`,
    })),
    followUps: picks.length
      ? ['Show only free entry', 'Somewhere quieter still', 'What is the best month?']
      : ['Widen the search radius'],
  };
}

function buildItinerary(ranked: AiCandidate[], prompt: string) {
  const dayCount = Math.max(1, Math.min(7, Number(/(\d+)\s*day/i.exec(prompt)?.[1] ?? 3)));
  const perDay = 3;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const slice = ranked.slice(index * perDay, index * perDay + perDay);
    return {
      dayNumber: index + 1,
      title: slice[0] ? `Around ${slice[0].city}` : `Day ${index + 1}`,
      activities: (slice.length ? slice : ranked.slice(0, 1)).map((candidate, position) => ({
        kind: 'PLACE' as const,
        placeId: candidate.id,
        title: candidate.title,
        note: `${describeCrowd(candidate.crowdLevel)}. ${candidate.summary.slice(0, 120)}`,
        startTimeMin: 9 * 60 + position * 210,
        durationMin: Math.min(240, candidate.durationMin || 120),
      })),
    };
  }).filter((day) => day.activities.length > 0);

  return {
    title: `${dayCount} quiet days`,
    summary:
      'A low-crowd route built only from places that exist in Anvesh, ordered so the busiest stop is never first.',
    days,
  };
}

function describeCrowd(crowdLevel: number): string {
  if (crowdLevel <= 0.2) return 'rarely crowded';
  if (crowdLevel <= 0.45) return 'quiet on weekdays';
  if (crowdLevel <= 0.7) return 'busy at weekends';
  return 'crowded, go at first light';
}

function stableHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 8);
}

export { stableHash };
