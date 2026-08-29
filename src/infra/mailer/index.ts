import { type Env } from '../../lib/config';
import { ConsoleMailer, type Mailer } from './mailer';
import { SmtpMailer } from './smtp-mailer';
import { ResendMailer } from './resend-mailer';

export * from './mailer';
export * from './templates';

export function createMailer(env: Env): Mailer {
  if (env.EMAIL_PROVIDER === 'resend') {
    if (!env.RESEND_API_KEY) return new ConsoleMailer();
    return new ResendMailer(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  if (env.EMAIL_PROVIDER === 'smtp') {
    return new SmtpMailer(env.EMAIL_FROM, env.SMTP_HOST, env.SMTP_PORT);
  }
  return new ConsoleMailer();
}
