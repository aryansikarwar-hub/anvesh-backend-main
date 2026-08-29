import { QUEUE_NAMES, type NotificationType } from '../lib/types';
import { JobRunner } from '../jobs/runner';
import { type Env } from '../lib/config';

/**
 * Publishes background work.
 *
 * Every method is fire-and-forget from the caller's point of view: a job that
 * fails must never fail the request that scheduled it. The work itself runs in
 * this same process — see src/jobs/runner.ts.
 */
export class QueuePublisher {
  constructor(private readonly runner: JobRunner) {}

  async bookingEmail(
    bookingId: string,
    kind: 'CONFIRMED' | 'CANCELLED',
    reason = '',
  ): Promise<void> {
    this.runner.dispatch(QUEUE_NAMES.EMAIL, `booking-${kind.toLowerCase()}`, {
      bookingId,
      kind,
      reason,
    });
  }

  async notify(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    href?: string | null;
  }): Promise<void> {
    this.runner.dispatch(QUEUE_NAMES.NOTIFICATION, input.type.toLowerCase(), {
      ...input,
      href: input.href ?? null,
    });
  }

  async trackEvent(input: {
    type: string;
    userId?: string | null;
    placeId?: string | null;
    experienceId?: string | null;
    query?: string | null;
  }): Promise<void> {
    this.runner.dispatch(QUEUE_NAMES.ANALYTICS, input.type.toLowerCase(), {
      type: input.type,
      userId: input.userId ?? null,
      placeId: input.placeId ?? null,
      experienceId: input.experienceId ?? null,
      query: input.query ?? null,
      occurredAt: new Date().toISOString(),
    });
  }

  async syncGuideSummary(guideId: string): Promise<void> {
    this.runner.dispatch(QUEUE_NAMES.SUMMARY, 'guide-summary', { guideId });
  }

  async refreshRecommendations(reason: 'CONFIG_CHANGED' | 'MANUAL'): Promise<void> {
    this.runner.dispatch(QUEUE_NAMES.RECOMMENDATION, 'refresh', { reason });
  }

  async close(): Promise<void> {
    this.runner.stop();
  }
}

export function createQueuePublisher(env: Env): { queue: QueuePublisher; runner: JobRunner } {
  const runner = new JobRunner(env);
  return { queue: new QueuePublisher(runner), runner };
}

/** Used in unit tests, where no background work should actually run. */
export class NoopQueuePublisher extends QueuePublisher {
  constructor() {
    super(null as unknown as JobRunner);
  }

  override async bookingEmail(): Promise<void> {}
  override async notify(): Promise<void> {}
  override async trackEvent(): Promise<void> {}
  override async syncGuideSummary(): Promise<void> {}
  override async refreshRecommendations(): Promise<void> {}
  override async close(): Promise<void> {}
}
