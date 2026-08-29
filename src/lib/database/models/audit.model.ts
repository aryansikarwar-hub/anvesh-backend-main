import { model, type Model, type Types } from 'mongoose';
import { createSchema } from '../plugins/base';

export interface AuditLogDocument {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: Types.ObjectId | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Append-only. No soft delete: an audit trail you can delete is not an audit trail. */
const auditLogSchema = createSchema<AuditLogDocument>(
  {
    actorId: { type: 'ObjectId', ref: 'User', required: true },
    actorEmail: { type: String, required: true, maxlength: 254 },
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, required: true, maxlength: 60 },
    targetId: { type: 'ObjectId', default: null },
    before: { type: Object, default: null },
    after: { type: Object, default: null },
    ip: { type: String, default: null, maxlength: 64 },
    userAgent: { type: String, default: null, maxlength: 300 },
    requestId: { type: String, required: true, maxlength: 64 },
  },
  { softDelete: false },
);

export const AuditLogModel: Model<AuditLogDocument> = model<AuditLogDocument>(
  'AuditLog',
  auditLogSchema,
  'auditlogs',
);

export interface OutboxEventDocument {
  _id: Types.ObjectId;
  type: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'DISPATCHED' | 'FAILED';
  attempts: number;
  lastError: string | null;
  dispatchedAt: Date | null;
  expiresAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transactional outbox. Written inside the same transaction as the change it
 * describes, then drained by the worker, so a queue outage can never leave the
 * database and the side-effects disagreeing.
 */
const outboxEventSchema = createSchema<OutboxEventDocument>({
  type: { type: String, required: true, maxlength: 80 },
  payload: { type: Object, required: true, default: {} },
  status: {
    type: String,
    enum: ['PENDING', 'DISPATCHED', 'FAILED'],
    required: true,
    default: 'PENDING',
  },
  attempts: { type: Number, required: true, default: 0, min: 0 },
  lastError: { type: String, default: null, maxlength: 600 },
  dispatchedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 7 * 86_400_000) },
});

export const OutboxEventModel: Model<OutboxEventDocument> = model<OutboxEventDocument>(
  'OutboxEvent',
  outboxEventSchema,
  'outboxevents',
);

export interface IdempotencyRecordDocument {
  _id: Types.ObjectId;
  key: string;
  userId: Types.ObjectId;
  scope: string;
  responseHash: string;
  resultId: Types.ObjectId | null;
  expiresAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const idempotencyRecordSchema = createSchema<IdempotencyRecordDocument>({
  key: { type: String, required: true, maxlength: 100 },
  userId: { type: 'ObjectId', ref: 'User', required: true },
  scope: { type: String, required: true, maxlength: 60 },
  responseHash: { type: String, required: true, maxlength: 64 },
  resultId: { type: 'ObjectId', default: null },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 86_400_000) },
});

export const IdempotencyRecordModel: Model<IdempotencyRecordDocument> =
  model<IdempotencyRecordDocument>(
    'IdempotencyRecord',
    idempotencyRecordSchema,
    'idempotencyrecords',
  );
