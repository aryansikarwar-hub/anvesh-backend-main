import nodemailer, { type Transporter } from 'nodemailer';
import { type EmailMessage, type Mailer } from './mailer';

/** SMTP transport. Points at Mailpit in local development. */
export class SmtpMailer implements Mailer {
  readonly name = 'smtp';
  private readonly transport: Transporter;

  constructor(
    private readonly from: string,
    host: string,
    port: number,
  ) {
    this.transport = nodemailer.createTransport({
      host,
      port,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
