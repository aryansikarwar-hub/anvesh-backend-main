import { type AiTask } from '../enums';

export interface AiProviderInfo {
  /** 'gemini' in production. 'stub' only when AI_PROVIDER=stub (see README). */
  provider: string;
  model: string;
  degraded: boolean;
}

export interface AiDiscoveryResult {
  answer: string;
  placeIds: string[];
  highlights: { placeId: string; why: string }[];
  followUps: string[];
  provider: AiProviderInfo;
}

export interface AiItineraryActivity {
  kind: 'PLACE' | 'EXPERIENCE' | 'NOTE';
  placeId?: string;
  experienceId?: string;
  title: string;
  note: string;
  startTimeMin: number | null;
  durationMin: number;
}

export interface AiItineraryDay {
  dayNumber: number;
  title: string;
  activities: AiItineraryActivity[];
}

export interface AiItineraryResult {
  title: string;
  summary: string;
  days: AiItineraryDay[];
  provider: AiProviderInfo;
}

export interface AiRequestLog {
  id: string;
  userId: string | null;
  task: AiTask;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  verdict: 'OK' | 'SCHEMA_REJECTED' | 'REFERENCE_REJECTED' | 'PROVIDER_ERROR';
  rejectionDetail: string | null;
  requestId: string;
  createdAt: string;
}
