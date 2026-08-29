import { Types } from 'mongoose';
import { NotificationModel } from '../../lib/database';
import { buildPageInfo, toSkipLimit } from '../../lib/shared';
import {
  ERROR_CODES,
  type Notification,
  type NotificationType,
  type Paginated,
} from '../../lib/types';
import { AppError } from '../../common/api-error';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
}

/** In-app notification feed. Email delivery is a separate worker concern. */
export class NotificationService {
  async create(input: CreateNotificationInput): Promise<void> {
    await NotificationModel.create([
      {
        userId: new Types.ObjectId(input.userId),
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
      },
    ]);
  }

  async list(
    userId: string,
    options: { page: number; limit: number; unreadOnly: boolean },
  ): Promise<Paginated<Notification> & { unreadCount: number }> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (options.unreadOnly) filter.readAt = null;
    const { skip, limit } = toSkipLimit(options.page, options.limit);

    const [items, total, unreadCount] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      NotificationModel.countDocuments(filter).exec(),
      NotificationModel.countDocuments({
        userId: new Types.ObjectId(userId),
        readAt: null,
      }).exec(),
    ]);

    return {
      items: items.map((item) => ({
        id: String(item._id),
        type: item.type,
        title: item.title,
        body: item.body,
        href: item.href,
        readAt: item.readAt ? item.readAt.toISOString() : null,
        createdAt: item.createdAt.toISOString(),
      })),
      pageInfo: buildPageInfo(options.page, options.limit, total),
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const updated = await NotificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
      { $set: { readAt: new Date() } },
    ).exec();
    if (!updated) throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      { userId: new Types.ObjectId(userId), readAt: null },
      { $set: { readAt: new Date() } },
    ).exec();
    return result.modifiedCount;
  }
}
