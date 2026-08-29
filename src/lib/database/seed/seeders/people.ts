import { GuideProfileModel, UserModel } from '../../models';
import { ADMIN_SEEDS, GUIDE_SEEDS, SEED_PASSWORD, TRAVELLER_SEEDS } from '../data/users';
import { hashPassword } from '../../security/password';
import { seedId, type SeedContext } from '../context';

export interface SeededPeople {
  travellerIds: Map<string, string>;
  guideUserIds: Map<string, string>;
  guideProfileIds: Map<string, string>;
}

export async function seedPeople(ctx: SeedContext): Promise<SeededPeople> {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const travellerIds = new Map<string, string>();
  const guideUserIds = new Map<string, string>();
  const guideProfileIds = new Map<string, string>();

  for (const t of TRAVELLER_SEEDS) {
    const id = seedId(`user:${t.key}`);
    await UserModel.updateOne(
      { _id: id },
      {
        $set: {
          email: t.email,
          emailVerifiedAt: ctx.now,
          role: 'TRAVELLER',
          portals: ['TRAVELLER'],
          status: 'ACTIVE',
          'profile.displayName': t.displayName,
          'profile.city': t.city,
          'profile.state': t.state,
          'profile.locale': 'en-IN',
          'preferences.interests': t.interests,
          'preferences.travelStyles': t.travelStyles,
          'preferences.budgetBand': t.budgetBand,
          'preferences.crowdTolerance': t.crowdTolerance,
          'preferences.prefersLocalOwned': t.prefersLocalOwned,
          'preferences.languages': t.languages,
          deletedAt: null,
        },
        $setOnInsert: { passwordHash, tokenVersion: 0 },
      },
      { upsert: true },
    );
    travellerIds.set(t.key, id.toHexString());
  }

  for (const g of GUIDE_SEEDS) {
    const userId = seedId(`user:${g.key}`);
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          email: g.email,
          emailVerifiedAt: ctx.now,
          role: 'TOURIST_GUIDE',
          // A guide may also browse as a traveller; both portals are explicit.
          portals: ['TOURIST_GUIDE', 'TRAVELLER'],
          status: 'ACTIVE',
          'profile.displayName': g.displayName,
          'profile.city': g.baseCity,
          'profile.state': g.baseState,
          'preferences.languages': g.languages,
          'preferences.interests': g.specialities,
          deletedAt: null,
        },
        $setOnInsert: { passwordHash, tokenVersion: 0 },
      },
      { upsert: true },
    );
    guideUserIds.set(g.key, userId.toHexString());

    const profileId = seedId(`guide:${g.key}`);
    await GuideProfileModel.updateOne(
      { _id: profileId },
      {
        $set: {
          userId,
          slug: g.slug,
          displayName: g.displayName,
          headline: g.headline,
          bio: g.bio,
          languages: g.languages,
          specialities: g.specialities,
          yearsExperience: g.yearsExperience,
          baseCity: g.baseCity,
          baseState: g.baseState,
          verified: g.verified,
          verifiedAt: g.verified ? ctx.now : null,
          deletedAt: null,
        },
        $setOnInsert: {
          ratingAvg: 0,
          ratingCount: 0,
          responseRate: 0.9,
        },
      },
      { upsert: true },
    );
    guideProfileIds.set(g.key, profileId.toHexString());
  }

  for (const a of ADMIN_SEEDS) {
    await UserModel.updateOne(
      { _id: seedId(`user:admin-${a.key}`) },
      {
        $set: {
          email: a.email,
          emailVerifiedAt: ctx.now,
          role: a.role,
          portals: ['ADMIN'],
          status: 'ACTIVE',
          'profile.displayName': a.displayName,
          deletedAt: null,
        },
        // TOTP is enrolled on first admin login; the seed never fakes a secret.
        $setOnInsert: { passwordHash, tokenVersion: 0, 'totp.enabled': false },
      },
      { upsert: true },
    );
  }

  ctx.log(
    `users: ${TRAVELLER_SEEDS.length} travellers, ${GUIDE_SEEDS.length} guides, ${ADMIN_SEEDS.length} admins`,
  );
  return { travellerIds, guideUserIds, guideProfileIds };
}
