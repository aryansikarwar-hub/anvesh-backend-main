import { type Env } from '../../lib/config';
import { GeminiProvider } from './gemini.provider';
import { StubAiProvider } from './stub.provider';
import { type AiProvider } from './ai-provider';

export * from './ai-provider';
export { GeminiProvider } from './gemini.provider';
export { StubAiProvider } from './stub.provider';

export function createAiProvider(env: Env): AiProvider {
  if (env.AI_PROVIDER === 'stub') return new StubAiProvider();
  return new GeminiProvider(env.GEMINI_MODEL, env.GEMINI_API_KEY, env.GEMINI_BASE_URL);
}
