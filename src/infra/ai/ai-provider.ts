/**
 * Provider abstraction for the LLM.
 *
 * Every provider receives a system prompt, a user prompt and a JSON schema, and
 * must return raw text that the caller will parse and validate. A provider is
 * never trusted to have produced valid output, and never decides what is a
 * real place — the candidate list it is given is the only source of ids.
 */
export interface AiCandidate {
  id: string;
  title: string;
  city: string;
  state: string;
  categories: string[];
  summary: string;
  crowdLevel: number;
  popularity: number;
  ratingAvg: number;
  entryFeeMinor: number;
  durationMin: number;
}

export interface AiCompletionRequest {
  system: string;
  user: string;
  /** JSON Schema the provider should be asked to conform to. */
  jsonSchema: Record<string, unknown>;
  candidates: AiCandidate[];
  maxOutputTokens?: number;
}

export interface AiCompletionResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  /** True when the provider can actually reach a model. */
  readonly available: boolean;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
