import { type BudgetBand, type Portal, type Role, type UserStatus } from '../enums';

export interface UserPreferences {
  interests: string[];
  travelStyles: string[];
  budgetBand: BudgetBand;
  /** 0 = hates crowds, 1 = does not mind crowds. Drives crowdPenalty weighting. */
  crowdTolerance: number;
  prefersLocalOwned: boolean;
  dietary: string[];
  languages: string[];
  homeCity?: string;
}

export interface UserProfile {
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  city?: string;
  state?: string;
  locale: string;
}

export interface PublicUser {
  id: string;
  role: Role;
  portals: Portal[];
  status: UserStatus;
  email: string;
  emailVerified: boolean;
  totpEnabled: boolean;
  profile: UserProfile;
  preferences: UserPreferences;
  createdAt: string;
}

export interface AuthUser {
  userId: string;
  role: Role;
  portal: Portal;
  tokenVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}

export interface AuthSession {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface GuideSummary {
  guideId: string;
  displayName: string;
  slug: string;
  avatarUrl?: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
}

export interface GuideProfile {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  languages: string[];
  specialities: string[];
  yearsExperience: number;
  baseCity: string;
  baseState: string;
  verified: boolean;
  verifiedAt?: string;
  ratingAvg: number;
  ratingCount: number;
  responseRate: number;
  createdAt: string;
}

export interface GuidePayoutInfo {
  accountHolderName: string;
  /** Never returned in full — the API masks all but the last 4 digits. */
  accountNumberMasked: string;
  ifsc: string;
  bankName: string;
  upiId?: string;
  verified: boolean;
}
