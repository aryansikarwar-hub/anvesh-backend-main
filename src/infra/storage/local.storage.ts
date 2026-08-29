import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type Env } from '../../lib/config';
import { ERROR_CODES } from '../../lib/types';
import { AppError } from '../../common/api-error';

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresInSeconds: number;
  requiredHeaders: Record<string, string>;
}

const UPLOAD_TTL_SECONDS = 900;

/** Only these ever reach disk; the key's extension is derived from the type. */
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/**
 * Media storage on the API server's own disk.
 *
 * The original design used S3 (Cloudflare R2 in production, MinIO locally),
 * which meant running MinIO alongside the API. Files are written under
 * `UPLOAD_DIR` instead and served back as static files from `/uploads`.
 *
 * The upload flow is unchanged from the client's point of view: it still asks
 * for an upload URL and then PUTs the bytes to it. The difference is that the
 * URL points at this API, and the "signature" is an HMAC over the key, content
 * type and exact byte length. A client still cannot choose its own path, send a
 * different type, or send more bytes than the server approved.
 */
export class FileStorage {
  private readonly root: string;
  private readonly secret: string;
  private readonly publicBase: string;

  constructor(private readonly env: Env) {
    this.root = path.resolve(env.UPLOAD_DIR);
    this.secret = env.JWT_ACCESS_SECRET;
    this.publicBase = `${env.API_BASE_URL.replace(/\/+$/, '')}/uploads`;
  }

  /** Disk storage is always available; there are no credentials to miss. */
  get configured(): boolean {
    return true;
  }

  get uploadRoot(): string {
    return this.root;
  }

  async presignUpload(input: {
    key: string;
    contentType: string;
    contentLength: number;
  }): Promise<PresignedUpload> {
    if (!ALLOWED_TYPES.has(input.contentType)) {
      throw new AppError(ERROR_CODES.MEDIA_TYPE_NOT_ALLOWED);
    }
    const expiresAt = Date.now() + UPLOAD_TTL_SECONDS * 1000;
    const token = this.sign({ ...input, expiresAt });

    return {
      uploadUrl: `${this.env.API_BASE_URL.replace(/\/+$/, '')}/api/v1/media/upload/${token}`,
      key: input.key,
      publicUrl: `${this.publicBase}/${input.key}`,
      expiresInSeconds: UPLOAD_TTL_SECONDS,
      requiredHeaders: {
        'content-type': input.contentType,
        'content-length': String(input.contentLength),
      },
    };
  }

  /**
   * Writes the bytes for a previously approved upload. Called only by the
   * upload route, after the token has been verified.
   */
  async write(key: string, body: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  /** Confirms the file really landed, and with the size we approved. */
  async verifyUploaded(key: string): Promise<{ contentLength: number; contentType: string }> {
    try {
      const info = await stat(this.resolve(key));
      return { contentLength: info.size, contentType: contentTypeFor(key) };
    } catch {
      throw new AppError(ERROR_CODES.MEDIA_UPLOAD_INCOMPLETE, {
        message: 'The file was never uploaded to storage.',
      });
    }
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => undefined);
  }

  // --- upload tokens --------------------------------------------------------

  private sign(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresAt: number;
  }): string {
    const payload = Buffer.from(JSON.stringify(input)).toString('base64url');
    const mac = createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${mac}`;
  }

  /** Returns the approved upload, or throws if the token is bad or expired. */
  verifyToken(token: string): {
    key: string;
    contentType: string;
    contentLength: number;
    expiresAt: number;
  } {
    const [payload, mac] = token.split('.');
    if (!payload || !mac) throw new AppError(ERROR_CODES.MEDIA_UPLOAD_INCOMPLETE);

    const expected = createHmac('sha256', this.secret).update(payload).digest('base64url');
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError(ERROR_CODES.MEDIA_UPLOAD_INCOMPLETE, {
        message: 'This upload link is not valid.',
      });
    }

    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      key: string;
      contentType: string;
      contentLength: number;
      expiresAt: number;
    };
    if (parsed.expiresAt < Date.now()) {
      throw new AppError(ERROR_CODES.MEDIA_UPLOAD_INCOMPLETE, {
        message: 'This upload link has expired. Ask for a new one.',
      });
    }
    return parsed;
  }

  /** Keeps a crafted key from escaping the upload directory. */
  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new AppError(ERROR_CODES.MEDIA_NOT_FOUND, { message: 'Invalid media key.' });
    }
    return target;
  }
}

function contentTypeFor(key: string): string {
  switch (path.extname(key).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}
