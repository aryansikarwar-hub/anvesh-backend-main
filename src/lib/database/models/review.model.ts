import { model, type Model, type Types } from 'mongoose';
import { REPORT_STATUSES, REVIEW_TARGETS } from '../../types';
import { createSchema } from '../plugins/base';

export interface ReviewDocument {
  _id: Types.ObjectId;
  targetType: (typeof REVIEW_TARGETS)[number];
  targetId: Types.ObjectId;
  userId: Types.ObjectId;
  authorName: string;
  authorAvatarUrl: string | null;
  bookingId: Types.ObjectId | null;
  rating: number;
  title: string;
  body: string;
  visitedAt: Date | null;
  crowdFelt: number | null;
  imageUrls: string[];
  helpfulCount: number;
  reportCount: number;
  status: 'PUBLISHED' | 'HIDDEN' | 'REMOVED';
  moderationNote: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = createSchema<ReviewDocument>({
  targetType: { type: String, enum: REVIEW_TARGETS, required: true },
  targetId: { type: 'ObjectId', required: true },
  userId: { type: 'ObjectId', ref: 'User', required: true },
  authorName: { type: String, required: true, maxlength: 80 },
  authorAvatarUrl: { type: String, default: null, maxlength: 1000 },
  bookingId: { type: 'ObjectId', ref: 'Booking', default: null },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, required: true, maxlength: 4000 },
  visitedAt: { type: Date, default: null },
  crowdFelt: { type: Number, default: null, min: 0, max: 1 },
  imageUrls: { type: [String], default: [] },
  helpfulCount: { type: Number, required: true, default: 0, min: 0 },
  reportCount: { type: Number, required: true, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['PUBLISHED', 'HIDDEN', 'REMOVED'],
    required: true,
    default: 'PUBLISHED',
  },
  moderationNote: { type: String, default: '', maxlength: 400 },
});

export const ReviewModel: Model<ReviewDocument> = model<ReviewDocument>(
  'Review',
  reviewSchema,
  'reviews',
);

export interface ContentReportDocument {
  _id: Types.ObjectId;
  targetType: 'PLACE' | 'EXPERIENCE' | 'REVIEW' | 'GUIDE';
  targetId: Types.ObjectId;
  reporterId: Types.ObjectId;
  reason: string;
  details: string;
  status: (typeof REPORT_STATUSES)[number];
  resolvedBy: Types.ObjectId | null;
  resolutionNote: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const contentReportSchema = createSchema<ContentReportDocument>({
  targetType: {
    type: String,
    enum: ['PLACE', 'EXPERIENCE', 'REVIEW', 'GUIDE'],
    required: true,
  },
  targetId: { type: 'ObjectId', required: true },
  reporterId: { type: 'ObjectId', ref: 'User', required: true },
  reason: { type: String, required: true, maxlength: 40 },
  details: { type: String, default: '', maxlength: 600 },
  status: { type: String, enum: REPORT_STATUSES, required: true, default: 'OPEN' },
  resolvedBy: { type: 'ObjectId', ref: 'User', default: null },
  resolutionNote: { type: String, default: '', maxlength: 600 },
});

export const ContentReportModel: Model<ContentReportDocument> = model<ContentReportDocument>(
  'ContentReport',
  contentReportSchema,
  'reports',
);
