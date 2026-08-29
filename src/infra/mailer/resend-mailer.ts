import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { type EmailMessage, type Mailer } from './mailer';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Real Resend HTTP client. Requires RESEND_API_KEY; never silently no-ops. */
export class ResendMailer implements Mailer {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, {
        message: 'Email could not be sent.',
        details: { status: response.status, detail: detail.slice(0, 200) },
      });
    }
  }
}
