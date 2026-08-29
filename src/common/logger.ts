import pino, { type Logger } from 'pino';
import { getContext } from './request-context';

let logger: Logger | null = null;

/**
 * Structured logging. `requestId` is attached automatically from the async
 * context, and the redact list keeps credentials and PII out of the log even
 * if a caller passes a whole object by mistake.
 */
export function createLogger(level: string, pretty: boolean): Logger {
  logger = pino({
    level,
    base: { service: 'anvesh-api' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'newPassword',
        'currentPassword',
        'passwordHash',
        'refreshToken',
        'accessToken',
        'token',
        'razorpaySignature',
        'email',
        'phone',
        'accountNumber',
        '*.password',
        '*.passwordHash',
        '*.email',
      ],
      censor: '[redacted]',
    },
    ...(pretty
      ? { transport: { target: 'pino/file', options: { destination: 1 } } }
      : {}),
  });
  return logger;
}

export function getLogger(): Logger {
  if (!logger) logger = createLogger('info', false);
  const ctx = getContext();
  return ctx ? logger.child({ requestId: ctx.requestId }) : logger;
}
