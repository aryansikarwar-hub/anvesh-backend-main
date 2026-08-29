import { Types } from 'mongoose';
import { AuditLogModel } from '../../lib/database';
import { buildPageInfo, toSkipLimit } from '../../lib/shared';
import { type AuditLogEntry, type Paginated } from '../../lib/types';
import { getContext, getRequestId } from '../../common/request-context';

export interface AuditInput {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Every admin write goes through here. The collection is append-only and has no
 * soft delete, because an audit trail that can be erased is not an audit trail.
 */
export class AuditService {
  async record(input: AuditInput): Promise<void> {
    const ctx = getContext();
    await AuditLogModel.create([
      {
        actorId: new Types.ObjectId(input.actorId),
        actorEmail: input.actorEmail,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ? new Types.ObjectId(input.targetId) : null,
        before: input.before ?? null,
        after: input.after ?? null,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        requestId: getRequestId(),
      },
    ]);
  }

  async list(options: {
    page: number;
    limit: number;
    actorId?: string;
    action?: string;
    targetType?: string;
    from?: string;
    to?: string;
  }): Promise<Paginated<AuditLogEntry>> {
    const filter: Record<string, unknown> = {};
    if (options.actorId) filter.actorId = new Types.ObjectId(options.actorId);
    if (options.action) filter.action = options.action;
    if (options.targetType) filter.targetType = options.targetType;
    if (options.from || options.to) {
      filter.createdAt = {
        ...(options.from ? { $gte: new Date(options.from) } : {}),
        ...(options.to ? { $lte: new Date(options.to) } : {}),
      };
    }

    const { skip, limit } = toSkipLimit(options.page, options.limit);
    const [items, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      AuditLogModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((item) => ({
        id: String(item._id),
        actorId: String(item.actorId),
        actorEmail: item.actorEmail,
        action: item.action,
        targetType: item.targetType,
        targetId: item.targetId ? String(item.targetId) : '',
        before: item.before,
        after: item.after,
        ip: item.ip,
        userAgent: item.userAgent,
        requestId: item.requestId,
        createdAt: item.createdAt.toISOString(),
      })),
      pageInfo: buildPageInfo(options.page, options.limit, total),
    };
  }
}
