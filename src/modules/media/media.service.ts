import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { MediaAssetModel } from '../../lib/database';
import { ERROR_CODES, type MediaKind } from '../../lib/types';
import { MAX_IMAGE_BYTES, type PresignUploadInput } from '../../lib/validation';
import { AppError } from '../../common/api-error';
import { type FileStorage } from '../../infra/storage/local.storage';

const DAILY_UPLOAD_QUOTA = 100;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * Media uploads.
 *
 * Two steps, exactly as before: the client asks for an upload URL with the
 * content type and byte length pinned, PUTs the bytes to it, then finalises —
 * and finalising re-checks what actually landed on disk. The key is generated
 * here, so a client can never choose its own path.
 */
export class MediaService {
  constructor(private readonly storage: FileStorage) {}

  async presign(userId: string, input: PresignUploadInput) {
    if (!this.storage.configured) {
      throw new AppError(ERROR_CODES.MEDIA_STORAGE_NOT_CONFIGURED);
    }
    if (input.contentLength > MAX_IMAGE_BYTES) {
      throw new AppError(ERROR_CODES.MEDIA_TOO_LARGE, {
        details: { maxBytes: MAX_IMAGE_BYTES },
      });
    }
    await this.assertQuota(userId);

    const extension = EXTENSIONS[input.contentType];
    if (!extension) throw new AppError(ERROR_CODES.MEDIA_TYPE_NOT_ALLOWED);

    const key = `${input.kind.toLowerCase()}/${userId}/${Date.now()}-${randomBytes(6).toString('hex')}.${extension}`;
    const presigned = await this.storage.presignUpload({
      key,
      contentType: input.contentType,
      contentLength: input.contentLength,
    });

    const [asset] = await MediaAssetModel.create([
      {
        ownerId: new Types.ObjectId(userId),
        kind: input.kind as MediaKind,
        key,
        url: presigned.publicUrl,
        contentType: input.contentType,
        contentLength: input.contentLength,
        status: 'PENDING',
      },
    ]);

    return {
      mediaId: String(asset?._id),
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      key,
      expiresInSeconds: presigned.expiresInSeconds,
      requiredHeaders: presigned.requiredHeaders,
    };
  }

  /** Marks an upload ready only after storage confirms the object exists. */
  async finalise(
    userId: string,
    input: { mediaId: string; width: number; height: number; alt: string; credit?: string },
  ) {
    const asset = await MediaAssetModel.findOne({
      _id: new Types.ObjectId(input.mediaId),
      ownerId: new Types.ObjectId(userId),
    }).exec();
    if (!asset) throw new AppError(ERROR_CODES.MEDIA_NOT_FOUND);

    const head = await this.storage.verifyUploaded(asset.key);
    if (head.contentLength > MAX_IMAGE_BYTES) {
      await this.storage.delete(asset.key);
      await MediaAssetModel.updateOne({ _id: asset._id }, { $set: { status: 'FAILED' } }).exec();
      throw new AppError(ERROR_CODES.MEDIA_TOO_LARGE);
    }
    if (!head.contentType.startsWith('image/')) {
      await this.storage.delete(asset.key);
      await MediaAssetModel.updateOne({ _id: asset._id }, { $set: { status: 'FAILED' } }).exec();
      throw new AppError(ERROR_CODES.MEDIA_TYPE_NOT_ALLOWED);
    }

    asset.set('status', 'READY');
    asset.set('width', input.width);
    asset.set('height', input.height);
    asset.set('alt', input.alt);
    asset.set('credit', input.credit ?? null);
    asset.set('contentLength', head.contentLength);
    await asset.save();

    return {
      key: asset.key,
      url: asset.url,
      width: input.width,
      height: input.height,
      alt: input.alt,
      ...(input.credit ? { credit: input.credit } : {}),
    };
  }

  async listMine(userId: string, limit: number) {
    const items = await MediaAssetModel.find({
      ownerId: new Types.ObjectId(userId),
      status: 'READY',
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
    return items.map((item) => ({
      id: String(item._id),
      key: item.key,
      url: item.url,
      width: item.width ?? 0,
      height: item.height ?? 0,
      alt: item.alt,
      kind: item.kind,
    }));
  }

  async remove(userId: string, mediaId: string): Promise<void> {
    const asset = await MediaAssetModel.findOne({
      _id: new Types.ObjectId(mediaId),
      ownerId: new Types.ObjectId(userId),
    }).exec();
    if (!asset) throw new AppError(ERROR_CODES.MEDIA_NOT_FOUND);
    await this.storage.delete(asset.key).catch(() => undefined);
    asset.set('deletedAt', new Date());
    await asset.save();
  }

  private async assertQuota(userId: string): Promise<void> {
    const since = new Date(Date.now() - 86_400_000);
    const used = await MediaAssetModel.countDocuments({
      ownerId: new Types.ObjectId(userId),
      createdAt: { $gte: since },
    }).exec();
    if (used >= DAILY_UPLOAD_QUOTA) {
      throw new AppError(ERROR_CODES.MEDIA_QUOTA_EXCEEDED, {
        details: { dailyLimit: DAILY_UPLOAD_QUOTA },
      });
    }
  }
}
