import { buildPageInfo, toSkipLimit } from '../../lib/shared';
import { ERROR_CODES, type Paginated, type PublicUser, type SavedPlace, type UserCollection } from '../../lib/types';
import { AppError } from '../../common/api-error';
import { toPublicUser } from '../auth/auth.mapper';
import { type AuthRepository } from '../auth/auth.repository';
import { MAX_COLLECTIONS_PER_USER, type UserRepository } from './user.repository';

export class UserService {
  constructor(
    private readonly repo: UserRepository,
    private readonly auth: AuthRepository,
  ) {}

  async updateProfile(userId: string, patch: Record<string, unknown>): Promise<PublicUser> {
    const user = await this.repo.updateProfile(userId, patch);
    if (!user) throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    return toPublicUser(user);
  }

  async updatePreferences(userId: string, patch: Record<string, unknown>): Promise<PublicUser> {
    const user = await this.repo.updatePreferences(userId, patch);
    if (!user) throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    return toPublicUser(user);
  }

  async savePlace(userId: string, placeId: string, collectionId: string | null): Promise<SavedPlace> {
    if (collectionId) {
      const owned = await this.repo.findOwnedCollection(userId, collectionId);
      if (!owned) throw new AppError(ERROR_CODES.COLLECTION_NOT_FOUND);
    }
    const saved = await this.repo.savePlace(userId, placeId, collectionId);
    if (!saved) throw new AppError(ERROR_CODES.PLACE_NOT_FOUND);
    if (collectionId) {
      const owned = await this.repo.findOwnedCollection(userId, collectionId);
      if (owned) await this.repo.recountCollection(userId, owned._id);
    }
    return toSavedPlace(saved as never);
  }

  async unsavePlace(userId: string, placeId: string): Promise<void> {
    const removed = await this.repo.unsavePlace(userId, placeId);
    if (!removed) throw new AppError(ERROR_CODES.NOT_FOUND, { message: 'That place was not saved.' });
  }

  async listSaved(
    userId: string,
    collectionId: string | null,
    page: number,
    limit: number,
  ): Promise<Paginated<SavedPlace>> {
    const { skip, limit: take } = toSkipLimit(page, limit);
    const { items, total } = await this.repo.listSaved(userId, collectionId, skip, take);
    return {
      items: items.map((i) => toSavedPlace(i as never)),
      pageInfo: buildPageInfo(page, limit, total),
    };
  }

  async createCollection(userId: string, input: Record<string, unknown>): Promise<UserCollection> {
    const count = await this.repo.countCollections(userId);
    if (count >= MAX_COLLECTIONS_PER_USER) {
      throw new AppError(ERROR_CODES.COLLECTION_LIMIT_REACHED, {
        details: { limit: MAX_COLLECTIONS_PER_USER },
      });
    }
    const created = await this.repo.createCollection(userId, input);
    return toCollection(created as never);
  }

  async listCollections(userId: string): Promise<UserCollection[]> {
    const items = await this.repo.listCollections(userId);
    return items.map((i) => toCollection(i as never));
  }

  async updateCollection(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<UserCollection> {
    const updated = await this.repo.updateOwnedCollection(userId, id, patch);
    if (!updated) throw new AppError(ERROR_CODES.COLLECTION_NOT_FOUND);
    return toCollection(updated as never);
  }

  async deleteCollection(userId: string, id: string): Promise<void> {
    const deleted = await this.repo.deleteOwnedCollection(userId, id);
    if (!deleted) throw new AppError(ERROR_CODES.COLLECTION_NOT_FOUND);
  }

  async ensureVerified(userId: string): Promise<void> {
    const user = await this.auth.findById(userId);
    if (!user) throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    if (!user.emailVerifiedAt) throw new AppError(ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED);
    if (user.status === 'SUSPENDED') throw new AppError(ERROR_CODES.AUTH_ACCOUNT_SUSPENDED);
  }
}

interface SavedRow {
  _id: unknown;
  placeId: unknown;
  collectionId: unknown;
  createdAt: Date;
  placeSummary: {
    placeId: unknown;
    title: string;
    slug: string;
    coverImageUrl?: string;
    city: string;
    categorySlugs: string[];
  };
}

function toSavedPlace(row: SavedRow): SavedPlace {
  return {
    id: String(row._id),
    placeId: String(row.placeId),
    collectionId: row.collectionId ? String(row.collectionId) : null,
    createdAt: row.createdAt.toISOString(),
    place: {
      placeId: String(row.placeSummary.placeId),
      title: row.placeSummary.title,
      slug: row.placeSummary.slug,
      ...(row.placeSummary.coverImageUrl
        ? { coverImageUrl: row.placeSummary.coverImageUrl }
        : {}),
      city: row.placeSummary.city,
      categorySlugs: row.placeSummary.categorySlugs,
    },
  };
}

interface CollectionRow {
  _id: unknown;
  name: string;
  description: string;
  isPublic: boolean;
  itemCount: number;
  coverImageUrl: string | null;
  createdAt: Date;
}

function toCollection(row: CollectionRow): UserCollection {
  return {
    id: String(row._id),
    name: row.name,
    description: row.description,
    isPublic: row.isPublic,
    itemCount: row.itemCount,
    ...(row.coverImageUrl ? { coverImageUrl: row.coverImageUrl } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}
