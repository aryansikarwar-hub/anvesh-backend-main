import { type NotificationType, type ReportStatus, type ReviewTarget } from '../enums';
import { type GeoPoint } from '../geo';
import { type PlaceSummary } from './content';

export interface Review {
  id: string;
  targetType: ReviewTarget;
  targetId: string;
  userId: string;
  authorName: string;
  authorAvatarUrl?: string;
  rating: number;
  title: string;
  body: string;
  visitedAt: string | null;
  crowdFelt: number | null;
  imageUrls: string[];
  helpfulCount: number;
  status: 'PUBLISHED' | 'HIDDEN' | 'REMOVED';
  createdAt: string;
  updatedAt: string;
}

export interface TripActivity {
  id: string;
  kind: 'PLACE' | 'EXPERIENCE' | 'NOTE';
  placeId?: string;
  experienceId?: string;
  title: string;
  note?: string;
  startTimeMin: number | null;
  durationMin: number;
  order: number;
  location: GeoPoint | null;
}

export interface TripDay {
  id: string;
  dayNumber: number;
  date: string | null;
  title: string;
  activities: TripActivity[];
}

export interface Trip {
  id: string;
  userId: string;
  title: string;
  destinationId: string | null;
  destinationName: string | null;
  startDate: string | null;
  endDate: string | null;
  travellers: number;
  notes: string;
  coverImageUrl?: string;
  days: TripDay[];
  generatedByAi: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedPlace {
  id: string;
  placeId: string;
  place: PlaceSummary;
  collectionId: string | null;
  createdAt: string;
}

export interface UserCollection {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  itemCount: number;
  coverImageUrl?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ContentReport {
  id: string;
  targetType: 'PLACE' | 'EXPERIENCE' | 'REVIEW' | 'GUIDE';
  targetId: string;
  reporterId: string;
  reason: string;
  details: string;
  status: ReportStatus;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
  createdAt: string;
}
