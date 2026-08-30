import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { type EmailMessage, type Mailer } from './mailer';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Real Resend HTTP client.
 * Requires RESEND_API_KEY; never silently no-ops.
 */
export class ResendMailer implements Mailer {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      const detail = await response.text().catch(() => '');

      if (!response.ok) {
        console.error('RESEND EMAIL ERROR', {
          status: response.status,
          detail,
          from: this.from,
          to: message.to,
          subject: message.subject,
        });

        throw new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, {
          message: 'Email could not be sent.',
          details: {
            status: response.status,
            detail: detail.slice(0, 500),
          },
        });
      }

      console.log('RESEND EMAIL SENT SUCCESSFULLY', {
        to: message.to,
        from: this.from,
        subject: message.subject,
        response: detail,
      });
    } catch (error) {
      console.error('RESEND MAILER FAILED', error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, {
        message: 'Email could not be sent.',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}