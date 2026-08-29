import { type AuthUser } from '../lib/types';

/**
 * The verified principal, attached by requireAuth. It is deliberately optional:
 * a handler that forgets to mount the guard gets `undefined`, not a fake user.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
      rawBody?: Buffer;
    }
  }
}

export {};
