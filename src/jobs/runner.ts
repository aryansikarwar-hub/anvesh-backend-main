import { type Env } from '../lib/config';
import { QUEUE_NAMES, type QueueName } from '../lib/types';
import { getLogger } from '../common/logger';
import { EmailSender, bookingEmailProcessor, emailProcessor } from './processors/email.processor';
import { notificationProcessor } from './processors/notification.processor';
import { recommendationProcessor } from './processors/recommendation.processor';
import { analyticsProcessor } from './processors/analytics.processor';
import { summaryProcessor, sweepAllGuideSummaries } from './processors/summary.processor';
import { cleanupProcessor } from './processors/cleanup.processor';

const CLEANUP_MS = 5 * 60_000;
const NIGHTLY_MS = 24 * 3_600_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 2_000;

type Handler = (payload: unknown) => Promise<unknown>;

/**
 * In-process background jobs.
 *
 * The original design ran a separate worker process fed by a Redis queue. That
 * needs Redis running alongside the API, which is one more service to install
 * and keep alive. Since every processor here is a plain async function of its
 * payload, the same work runs inside the API process instead: `dispatch` is
 * fire-and-forget with bounded retries, and the two timers below replace the
 * queue's repeatable jobs.
 *
 * The trade-off is deliberate and worth stating: work is lost if the process
 * dies mid-job, and it does not scale past one instance. `EXPIRE_BOOKINGS` is
 * the job that matters most, and it is a sweep — a missed run is repaired by
 * the next one five minutes later, not lost.
 */
export class JobRunner {
  private readonly handlers: Record<QueueName, Handler>;
  private readonly timers: NodeJS.Timeout[] = [];
  private inFlight = 0;

  constructor(env: Env) {
    const emailSender = new EmailSender(env);
    const email = emailProcessor(emailSender);
    const bookingEmail = bookingEmailProcessor(emailSender, env.WEB_APP_URL);

    this.handlers = {
      [QUEUE_NAMES.EMAIL]: async (payload) => {
        const data = payload as { kind?: string };
        return data?.kind === 'CONFIRMED' || data?.kind === 'CANCELLED'
          ? bookingEmail(payload)
          : email(payload);
      },
      [QUEUE_NAMES.NOTIFICATION]: notificationProcessor(),
      [QUEUE_NAMES.RECOMMENDATION]: recommendationProcessor(),
      [QUEUE_NAMES.ANALYTICS]: analyticsProcessor(),
      [QUEUE_NAMES.SUMMARY]: summaryProcessor(),
      [QUEUE_NAMES.CLEANUP]: cleanupProcessor(),
      [QUEUE_NAMES.MEDIA]: async () => undefined,
      [QUEUE_NAMES.AI]: async () => undefined,
    };
  }

  /**
   * Queues work without making the caller wait for it, and without letting a
   * failure surface in the request that triggered it. A booking that has been
   * paid for must never fail because its confirmation email did not send.
   */
  dispatch(queue: QueueName, jobName: string, payload: unknown): void {
    void this.run(queue, jobName, payload);
  }

  /** Awaits the job. Used by the schedulers and by tests. */
  async run(queue: QueueName, jobName: string, payload: unknown): Promise<void> {
    const handler = this.handlers[queue];
    if (!handler) return;

    this.inFlight += 1;
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          await handler(payload);
          return;
        } catch (error) {
          if (attempt === MAX_ATTEMPTS) {
            getLogger().error({ err: error, queue, jobName, attempt }, 'job failed, giving up');
            return;
          }
          getLogger().warn({ err: error, queue, jobName, attempt }, 'job failed, retrying');
          await delay(RETRY_BASE_MS * attempt);
        }
      }
    } finally {
      this.inFlight -= 1;
    }
  }

  /** Repeatable work: seat release every few minutes, ranking refresh nightly. */
  startSchedulers(): void {
    const cleanup = setInterval(() => {
      void this.run(QUEUE_NAMES.CLEANUP, 'expire-bookings', { task: 'EXPIRE_BOOKINGS' });
      void this.run(QUEUE_NAMES.CLEANUP, 'drain-outbox', { task: 'DRAIN_OUTBOX' });
    }, CLEANUP_MS);

    const nightly = setInterval(() => {
      void this.run(QUEUE_NAMES.RECOMMENDATION, 'nightly', { reason: 'NIGHTLY' });
      void this.run(QUEUE_NAMES.CLEANUP, 'purge-media', { task: 'PURGE_PENDING_MEDIA' });
      void sweepAllGuideSummaries().catch((error: unknown) => {
        getLogger().error({ err: error }, 'guide summary sweep failed');
      });
    }, NIGHTLY_MS);

    cleanup.unref();
    nightly.unref();
    this.timers.push(cleanup, nightly);

    getLogger().info(
      { cleanupEveryMinutes: CLEANUP_MS / 60_000 },
      'background jobs running inside the API process',
    );
  }

  get pending(): number {
    return this.inFlight;
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
