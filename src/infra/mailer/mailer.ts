import { getLogger } from '../../common/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/**
 * Used only when EMAIL_PROVIDER=console. It writes the message to the log
 * instead of sending it, and says so — nothing pretends a mail went out.
 */
export class ConsoleMailer implements Mailer {
  readonly name = 'console';

  async send(message: EmailMessage): Promise<void> {
    getLogger().warn(
      { subject: message.subject, preview: message.text.slice(0, 200) },
      'email not sent: EMAIL_PROVIDER=console',
    );
  }
}
