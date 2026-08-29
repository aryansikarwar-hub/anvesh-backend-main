import nodemailer, { type Transporter } from 'nodemailer';
import { type Env } from '../../lib/config';
import { BookingModel } from '../../lib/database';
import { bookingEmailJobSchema, emailJobSchema } from '../../lib/validation';
import { log } from '../logger';

interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Email delivery.
 *
 * SMTP (Mailpit) locally, the Resend HTTP API in production. With
 * EMAIL_PROVIDER=console nothing is sent and the log says so explicitly rather
 * than reporting a delivery that never happened.
 */
export class EmailSender {
  private readonly transport: Transporter | null;

  constructor(private readonly env: Env) {
    this.transport =
      env.EMAIL_PROVIDER === 'smtp'
        ? nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: false,
            tls: { rejectUnauthorized: false },
          })
        : null;
  }

  async send(message: Message): Promise<void> {
    if (this.env.EMAIL_PROVIDER === 'resend') {
      if (!this.env.RESEND_API_KEY) {
        log().warn('email not sent: RESEND_API_KEY missing');
        return;
      }
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!response.ok) throw new Error(`Resend rejected the message: ${response.status}`);
      return;
    }

    if (!this.transport) {
      log().warn({ subject: message.subject }, 'email not sent: EMAIL_PROVIDER=console');
      return;
    }

    await this.transport.sendMail({
      from: this.env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

export function emailProcessor(sender: EmailSender) {
  return async (payload: unknown): Promise<void> => {
    await sender.send(emailJobSchema.parse(payload));
  };
}

/** Composes a booking email from the booking itself, never from the job. */
export function bookingEmailProcessor(sender: EmailSender, webAppUrl: string) {
  return async (payload: unknown): Promise<void> => {
    const job = bookingEmailJobSchema.parse(payload);
    const booking = await BookingModel.findById(job.bookingId).select('+travellerEmail').exec();
    if (!booking) {
      log().warn({ bookingId: job.bookingId }, 'booking email skipped: booking not found');
      return;
    }

    const when = booking.startAt.toISOString().replace('T', ' ').slice(0, 16);
    const url = `${webAppUrl}/bookings/${String(booking._id)}`;
    const confirmed = job.kind === 'CONFIRMED';

    await sender.send({
      to: booking.travellerEmail,
      subject: confirmed
        ? `Booking confirmed — ${booking.experienceTitle}`
        : `Booking cancelled — ${booking.experienceTitle}`,
      text: confirmed
        ? `Booking ${booking.code} confirmed for ${booking.experienceTitle} on ${when}. ${url}`
        : `Booking ${booking.code} for ${booking.experienceTitle} was cancelled. ${job.reason}`,
      html: confirmed
        ? `<p>Your booking <strong>${booking.code}</strong> for ${booking.experienceTitle} on ${when} is confirmed.</p><p><a href="${url}">View booking</a></p>`
        : `<p>Booking <strong>${booking.code}</strong> for ${booking.experienceTitle} was cancelled.</p><p>${job.reason}</p>`,
    });
  };
}
