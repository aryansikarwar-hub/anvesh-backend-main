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
const UNSUITABLE = /(lite|image|tts|live|audio|native|exp|thinking|computer|robotics|embedding|vision|learnlm|gemma)/i;

/**
 * Picks the newest plain "gemini-<version>-flash" model that can generateContent.
 * Exported for tests.
 */
export function pickFlashModel(list: GeminiModelList): string | null {
  const scored = (list.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter((name) => /^gemini-\d+(\.\d+)?-flash(-\d+)?$/.test(name) && !UNSUITABLE.test(name))
    .map((name) => ({ name, version: parseFloat(/^gemini-(\d+(?:\.\d+)?)-flash/.exec(name)?.[1] ?? '0') }))
    .sort((a, b) => b.version - a.version || a.name.length - b.name.length);
  if (scored[0]) return scored[0].name;
  const alias = (list.models ?? []).find((m) => m.name === 'models/gemini-flash-latest');
  return alias ? 'gemini-flash-latest' : null;
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

    let response = await this.call(this.model, request);

    // 404 = this key/project cannot use that model any more (Google retires and
    // restricts models). Ask the API what this key CAN use and retry once.
    if (response.status === 404) {
      const replacement = await this.discoverModel();
      if (replacement && replacement !== this.model) {
        getLogger().warn(
          { from: this.model, to: replacement },
          'Gemini model not found; switching to a model this key can use',
        );
        response = await this.call(replacement, request);
        if (response.ok) this.resolvedModel = replacement;
      }
    }

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      throw new AppError(ERROR_CODES.AI_PROVIDER_ERROR, {
        message: `Gemini rejected the request (HTTP ${response.status}): ${extractMessage(raw)}`,
        details: { status: response.status, model: this.model },
      });
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

  private async call(model: string, request: AiCompletionRequest): Promise<Response> {
    // 2.5-flash "thinks" and thinking tokens count against maxOutputTokens;
    // structured extraction does not need it, so switch it off where supported.
    const thinking = /gemini-2\.5-flash(?!-lite)/.test(model)
      ? { thinkingConfig: { thinkingBudget: 0 } }
      : {};
    try {
      return await fetch(`${this.baseUrl}/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey ?? '' },
        signal: AbortSignal.timeout(45_000),
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
      throw new AppError(ERROR_CODES.AI_PROVIDER_ERROR, {
        message: `Could not reach Gemini: ${error instanceof Error ? error.message : 'network error'}`,
      });
    }
  }

  private async discoverModel(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/v1beta/models?pageSize=200`, {
        headers: { 'x-goog-api-key': this.apiKey ?? '' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      return pickFlashModel((await res.json()) as GeminiModelList);
    } catch {
      return null;
    }
  }
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