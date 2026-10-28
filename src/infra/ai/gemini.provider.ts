// import { ERROR_CODES } from '../../lib/types';
// import { AppError } from '../../common/api-error';
// import {
//   type AiCompletionRequest,
//   type AiCompletionResult,
//   type AiProvider,
// } from './ai-provider';

// interface GeminiResponse {
//   candidates?: { content?: { parts?: { text?: string }[] } }[];
//   usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
// }

// /** Real Gemini client, using structured JSON output. */
// export class GeminiProvider implements AiProvider {
//   readonly name = 'gemini';

//   constructor(
//     readonly model: string,
//     private readonly apiKey: string | undefined,
//     private readonly baseUrl: string,
//   ) {}

//   get available(): boolean {
//     return Boolean(this.apiKey);
//   }

//   async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
//     if (!this.apiKey) {
//       throw new AppError(ERROR_CODES.AI_PROVIDER_NOT_CONFIGURED, {
//         message: 'GEMINI_API_KEY is not set on this deployment.',
//       });
//     }

//     const url = `${this.baseUrl}/v1beta/models/${this.model}:generateContent`;
//     const response = await fetch(url, {
//       method: 'POST',
//       headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
//       body: JSON.stringify({
//         systemInstruction: { parts: [{ text: request.system }] },
//         contents: [{ role: 'user', parts: [{ text: request.user }] }],
//         generationConfig: {
//           temperature: 0.4,
//           maxOutputTokens: request.maxOutputTokens ?? 2048,
//           responseMimeType: 'application/json',
//           responseSchema: request.jsonSchema,
//         },
//       }),
//     });

//     if (!response.ok) {
//       const detail = await response.text().catch(() => '');
//       throw new AppError(ERROR_CODES.AI_PROVIDER_ERROR, {
//         details: { status: response.status, detail: detail.slice(0, 300) },
//       });
//     }

//     const payload = (await response.json()) as GeminiResponse;
//     const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
//     if (!text) {
//       throw new AppError(ERROR_CODES.AI_PROVIDER_ERROR, {
//         message: 'The model returned an empty response.',
//       });
//     }

//     return {
//       text,
//       promptTokens: payload.usageMetadata?.promptTokenCount ?? 0,
//       completionTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
//     };
//   }
// }
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { getLogger } from '../../common/logger';
import {
  type AiCompletionRequest,
  type AiCompletionResult,
  type AiProvider,
} from './ai-provider';

interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

interface GeminiModelList {
  models?: { name?: string; supportedGenerationMethods?: string[] }[];
}

/** Variants we never want to auto-pick for plain JSON text generation. */
const UNSUITABLE = /(image|tts|live|audio|native|exp|thinking|computer|robotics|embedding|vision|learnlm|gemma)/i;
const MAX_FALLBACK_MODELS = 3;

/**
 * Usable text models for this key, best first: newest plain "gemini-<v>-flash",
 * then the newest "-flash-lite" (cheaper, rarely overloaded). Exported for tests.
 */
export function pickFlashModels(list: GeminiModelList): string[] {
  const names = (list.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter((name) => !UNSUITABLE.test(name));
  const version = (name: string) => parseFloat(/^gemini-(\d+(?:\.\d+)?)-/.exec(name)?.[1] ?? '0');
  const byNewest = (a: string, b: string) => version(b) - version(a) || a.length - b.length;
  const flash = names.filter((n) => /^gemini-\d+(\.\d+)?-flash(-\d+)?$/.test(n)).sort(byNewest);
  const lite = names.filter((n) => /^gemini-\d+(\.\d+)?-flash-lite(-\d+)?$/.test(n)).sort(byNewest);
  // Fallback order matters: the newest flash is the usual primary, so after it
  // fails the fast lite model goes first, then the remaining flash models.
  const out = [flash[0], ...lite, ...flash.slice(1)].filter((n): n is string => Boolean(n));
  if (out.length === 0 && (list.models ?? []).some((m) => m.name === 'models/gemini-flash-latest')) {
    out.push('gemini-flash-latest');
  }
  return out;
}

export function pickFlashModel(list: GeminiModelList): string | null {
  return pickFlashModels(list)[0] ?? null;
}

/** Real Gemini client, using structured JSON output. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  /** Set when the configured model is gone and another one was found. */
  private resolvedModel: string | null = null;

  constructor(
    private readonly configuredModel: string,
    private readonly apiKey: string | undefined,
    private readonly baseUrl: string,
    private readonly retryDelayMs = 800,
  ) {}

  get model(): string {
    return this.resolvedModel ?? this.configuredModel;
  }

  get available(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    if (!this.apiKey) {
      throw new AppError(ERROR_CODES.AI_PROVIDER_NOT_CONFIGURED, {
        message: 'GEMINI_API_KEY is not set on this deployment.',
      });
    }

    // Gemini is regularly overloaded (503) or a model is gone for this key (404).
    // Retry transient failures with a short wait, then fall back to other models
    // this key can use. Auth/validation errors (400/401/403) are returned at once.
    const deadline = Date.now() + 50_000;
    const queue = [this.model];
    const tried = new Set<string>();
    let discovered = false;
    let response: Response | null = null;
    let usedModel = this.model;

    while (queue.length > 0 && Date.now() < deadline) {
      const model = queue.shift() as string;
      if (tried.has(model)) continue;
      tried.add(model);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await this.call(model, request);
        if (response.status === 400) {
          // Some models reject a thinking option they do not support; retry without it.
          const body = await response.clone().text().catch(() => '');
          if (/thinking/i.test(body)) response = await this.call(model, request, true);
        }
        usedModel = model;
        const retryable = [500, 502, 503, 504].includes(response.status);
        if (response.ok || !retryable || attempt === 2 || Date.now() >= deadline) break;
        await sleep(this.retryDelayMs * 2 ** attempt);
      }
      if (response?.ok) break;

      const switchable = [404, 429, 500, 502, 503, 504, 599].includes(response?.status ?? 0);
      if (!switchable) break;
      if (!discovered) {
        discovered = true;
        queue.push(...(await this.discoverModels()).slice(0, MAX_FALLBACK_MODELS + 1));
      }
    }

    if (!response || !response.ok) {
      const raw = (await response?.text().catch(() => '')) ?? '';
      throw new AppError(ERROR_CODES.AI_PROVIDER_ERROR, {
        message: `Gemini rejected the request (HTTP ${response?.status ?? 'none'}): ${extractMessage(raw)}`,
        details: { status: response?.status ?? null, triedModels: [...tried] },
      });
    }

    if (usedModel !== this.model) {
      getLogger().warn({ from: this.model, to: usedModel }, 'Gemini: using a different model');
      this.resolvedModel = usedModel;
    }

    const payload = (await response.json()) as GeminiResponse;
    const candidate = payload.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('');
    if (!text) {
      throw new AppError(ERROR_CODES.AI_PROVIDER_ERROR, {
        message: `The model returned an empty response (finishReason: ${candidate?.finishReason ?? 'unknown'}).`,
      });
    }

    return {
      text,
      promptTokens: payload.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  private async call(
    model: string,
    request: AiCompletionRequest,
    skipThinking = false,
  ): Promise<Response> {
    // Thinking models spend time (and output tokens) "reasoning" before they
    // answer. Structured extraction does not need it, so keep it minimal.
    let thinking: Record<string, unknown> = {};
    if (!skipThinking) {
      if (/gemini-2\.5-flash(?!-lite)/.test(model)) thinking = { thinkingConfig: { thinkingBudget: 0 } };
      else if (/^gemini-3/.test(model)) thinking = { thinkingConfig: { thinkingLevel: 'low' } };
    }
    try {
      return await fetch(`${this.baseUrl}/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey ?? '' },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts: [{ text: request.user }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: request.maxOutputTokens ?? 8192,
            responseMimeType: 'application/json',
            responseSchema: request.jsonSchema,
            ...thinking,
          },
        }),
      });
    } catch (error) {
      // Timeout / network failure: report it as a synthetic 599 so the caller can
      // move on to another model instead of waiting on this one again.
      const reason = error instanceof Error ? error.message : 'network error';
      return new Response(
        JSON.stringify({ error: { message: `Could not reach ${model}: ${reason}` } }),
        { status: 599 },
      );
    }
  }

  private async discoverModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/v1beta/models?pageSize=200`, {
        headers: { 'x-goog-api-key': this.apiKey ?? '' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return [];
      return pickFlashModels((await res.json()) as GeminiModelList);
    } catch {
      return [];
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message.slice(0, 300);
  } catch {
    /* not JSON */
  }
  return raw.slice(0, 300) || 'no detail';
}