/** Portals are independent authorization surfaces (see docs/security.md §3). */
export const PORTALS = ['TRAVELLER', 'TOURIST_GUIDE', 'ADMIN'] as const;
export type Portal = (typeof PORTALS)[number];

export const ROLES = ['TRAVELLER', 'TOURIST_GUIDE', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Which portal(s) a role is allowed to sign into. */
export const ROLE_PORTALS: Record<Role, readonly Portal[]> = {
  TRAVELLER: ['TRAVELLER'],
  TOURIST_GUIDE: ['TOURIST_GUIDE', 'TRAVELLER'],
  MODERATOR: ['ADMIN'],
  ADMIN: ['ADMIN'],
  SUPER_ADMIN: ['ADMIN'],
};

export const ADMIN_ROLES = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'] as const;

export const USER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CONTENT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * The kinds of local story a guide can write. Deliberately a closed list: a
 * free-text "category" turns into a tag soup nobody can browse.
 */
export const STORY_KINDS = [
  'FOOD',
  'CRAFT',
  'FESTIVAL',
  'HISTORY',
  'NATURE',
  'PEOPLE',
] as const;
export type StoryKind = (typeof STORY_KINDS)[number];

export const OWNERSHIP_TYPES = ['LOCAL_OWNED', 'CHAIN', 'GOVERNMENT', 'COMMUNITY', 'UNKNOWN'] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const BUDGET_BANDS = ['LOW', 'MID', 'HIGH'] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];

export const SLOT_STATUSES = ['OPEN', 'CLOSED', 'CANCELLED'] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const BOOKING_STATUSES = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED_BY_USER',
  'CANCELLED_BY_GUIDE',
  'EXPIRED',
  'COMPLETED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Explicit booking state machine. Anything not listed here is rejected. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'EXPIRED', 'CANCELLED_BY_USER'],
  CONFIRMED: ['COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_GUIDE', 'REFUNDED', 'PARTIALLY_REFUNDED'],
  CANCELLED_BY_USER: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  CANCELLED_BY_GUIDE: ['REFUNDED'],
  EXPIRED: [],
  COMPLETED: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ['REFUNDED'],
};

export const PAYMENT_STATUSES = [
  'CREATED',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Explicit payment state machine. */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ['AUTHORIZED', 'CAPTURED', 'FAILED'],
  AUTHORIZED: ['CAPTURED', 'FAILED'],
  CAPTURED: ['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  FAILED: [],
  REFUND_PENDING: ['PARTIALLY_REFUNDED', 'REFUNDED', 'CAPTURED'],
  PARTIALLY_REFUNDED: ['REFUND_PENDING', 'REFUNDED'],
  REFUNDED: [],
};

export const REVIEW_TARGETS = ['PLACE', 'EXPERIENCE'] as const;
export type ReviewTarget = (typeof REVIEW_TARGETS)[number];

export const REPORT_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'BOOKING_CREATED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_REMINDER',
  'PAYMENT_CAPTURED',
  'PAYMENT_FAILED',
  'REFUND_PROCESSED',
  'REVIEW_RECEIVED',
  'PLACE_APPROVED',
  'PLACE_REJECTED',
  'EXPERIENCE_APPROVED',
  'EXPERIENCE_REJECTED',
  'GUIDE_VERIFIED',
  'ADMIN_ALERT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const MEDIA_KINDS = ['PLACE', 'EXPERIENCE', 'AVATAR', 'DESTINATION', 'KYC'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  RECOMMENDATION: 'recommendation',
  ANALYTICS: 'analytics',
  MEDIA: 'media',
  SUMMARY: 'summary',
  AI: 'ai',
  CLEANUP: 'cleanup',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const AI_TASKS = ['DISCOVER', 'ITINERARY', 'EXPLAIN', 'SUGGEST'] as const;
export type AiTask = (typeof AI_TASKS)[number];

export const CURRENCY = 'INR' as const;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata' as const;
