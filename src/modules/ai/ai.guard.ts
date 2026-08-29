import { type ZodType } from 'zod';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../../common/api-error';

export interface ReferenceCheck {
  placeIds: string[];
  experienceIds: string[];
}

export type ReferenceResolver = (refs: ReferenceCheck) => Promise<{
  knownPlaceIds: Set<string>;
  knownExperienceIds: Set<string>;
}>;

export interface GuardOutcome<T> {
  value: T;
  verdict: 'OK';
}

/**
 * THE AI SAFETY RULE (docs/spec.md section 9).
 *
 * 1. The model's text must parse as JSON.
 * 2. It must satisfy the Zod schema exactly.
 * 3. Every place and experience id it references must exist and be published.
 *
 * Only then does the caller see it. An output that names an id the database
 * does not have is rejected with AI_HALLUCINATED_REFERENCE and is never
 * returned to a user or written to a trip.
 */
export async function guardAiOutput<T>(
  rawText: string,
  schema: ZodType<T>,
  extractRefs: (value: T) => ReferenceCheck,
  resolve: ReferenceResolver,
): Promise<GuardOutcome<T>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(rawText));
  } catch {
    throw new AppError(ERROR_CODES.AI_OUTPUT_INVALID, {
      message: 'The assistant did not return valid JSON.',
      details: { stage: 'json' },
    });
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(ERROR_CODES.AI_OUTPUT_INVALID, {
      message: 'The assistant returned a response in an unexpected shape.',
      details: {
        stage: 'schema',
        issues: result.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
      },
    });
  }

  const refs = extractRefs(result.data);
  if (refs.placeIds.length === 0 && refs.experienceIds.length === 0) {
    return { value: result.data, verdict: 'OK' };
  }

  const known = await resolve(refs);
  const unknownPlaces = refs.placeIds.filter((id) => !known.knownPlaceIds.has(id));
  const unknownExperiences = refs.experienceIds.filter(
    (id) => !known.knownExperienceIds.has(id),
  );

  if (unknownPlaces.length > 0 || unknownExperiences.length > 0) {
    throw new AppError(ERROR_CODES.AI_HALLUCINATED_REFERENCE, {
      details: { unknownPlaces, unknownExperiences },
    });
  }

  return { value: result.data, verdict: 'OK' };
}

/** Some models wrap JSON in a markdown fence even when asked not to. */
export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();
}
