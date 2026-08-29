import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../../common/api-error';

const ALGORITHM = 'aes-256-gcm';

/**
 * TOTP for the admin portal. Secrets are encrypted at rest with
 * TOTP_ENCRYPTION_KEY; recovery codes are stored only as SHA-256 hashes.
 */
export class TotpService {
  private readonly key: Buffer;

  constructor(
    encryptionKey: string,
    private readonly issuer: string,
  ) {
    this.key = createHash('sha256').update(encryptionKey).digest();
    authenticator.options = { window: 1, step: 30 };
  }

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  otpauthUrl(secret: string, accountEmail: string): string {
    return authenticator.keyuri(accountEmail, this.issuer, secret);
  }

  verify(secret: string, code: string): boolean {
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) throw new AppError(ERROR_CODES.AUTH_TOTP_INVALID);
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  generateRecoveryCodes(count = 8): { codes: string[]; hashes: string[] } {
    const codes = Array.from({ length: count }, () =>
      randomBytes(5).toString('hex').toUpperCase().replace(/(.{5})/, '$1-'),
    );
    return { codes, hashes: codes.map((c) => createHash('sha256').update(c).digest('hex')) };
  }

  hashRecoveryCode(code: string): string {
    return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  }
}
