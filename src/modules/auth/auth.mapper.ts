import { type UserDocument } from '../../lib/database';
import { type PublicUser } from '../../lib/types';

/**
 * The only shape of a user that ever leaves the API. Password hashes, TOTP
 * secrets, phone numbers and login counters are not part of it.
 */
export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: String(user._id),
    role: user.role,
    portals: user.portals,
    status: user.status,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    totpEnabled: Boolean(user.totp?.enabled),
    profile: {
      displayName: user.profile.displayName,
      ...(user.profile.avatarUrl ? { avatarUrl: user.profile.avatarUrl } : {}),
      ...(user.profile.bio ? { bio: user.profile.bio } : {}),
      ...(user.profile.city ? { city: user.profile.city } : {}),
      ...(user.profile.state ? { state: user.profile.state } : {}),
      locale: user.profile.locale,
    },
    preferences: {
      interests: user.preferences.interests,
      travelStyles: user.preferences.travelStyles,
      budgetBand: user.preferences.budgetBand,
      crowdTolerance: user.preferences.crowdTolerance,
      prefersLocalOwned: user.preferences.prefersLocalOwned,
      dietary: user.preferences.dietary,
      languages: user.preferences.languages,
      ...(user.preferences.homeCity ? { homeCity: user.preferences.homeCity } : {}),
    },
    createdAt: user.createdAt.toISOString(),
  };
}
