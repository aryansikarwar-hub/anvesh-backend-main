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
import {
  type AiCompletionRequest,
  type AiCompletionResult,
  type AiProvider,
} from './ai-provider';

interface GeminiResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/** Real Gemini client, using structured JSON output. */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';

  constructor(
    readonly model: string,
    private readonly apiKey: string | undefined,
    private readonly baseUrl: string,
  ) {}

  get available(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    if (!this.apiKey) {
      throw new AppError(ERROR_CODES.AI_PROVIDER_NOT_CONFIGURED, {
        message: 'GEMINI_API_KEY is not set on this deployment.',
      });
    }

    const url = `${this.baseUrl}/v1beta/models/${this.model}:generateContent`;

    // gemini-2.5-flash "thinks" before answering and thinking tokens are counted
    // against maxOutputTokens, which can leave no room for the JSON itself.
    // Structured extraction does not need it, so it is switched off.
    const thinking = /gemini-2\.5-flash/.test(this.model)
      ? { thinkingConfig: { thinkingBudget: 0 } }
      : {};

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts: [{ text: request.user }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: request.maxOutputTokens ?? 4096,
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

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AppError(ERROR_CODES.AI_PROVIDER_ERROR, {
        message: `Gemini rejected the request (HTTP ${response.status}).`,
        details: { status: response.status, detail: detail.slice(0, 300) },
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
        message: 'The model returned an empty response.',
        details: { finishReason: candidate?.finishReason ?? null },
      });
    }
    return {
      text,
      promptTokens: payload.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}