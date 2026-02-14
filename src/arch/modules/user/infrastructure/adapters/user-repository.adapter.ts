// Adapter de lecture : implemente le port UserRepositoryPort avec Drizzle ORM
// Lit depuis des vues SQL dediees (separation read/write)

import { DrizzleService } from '@common/db/drizzle.service';
import { userMeView, userPublicView } from '@common/db/schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  PublicUserProfileSnapshot,
  UserProfileSnapshot,
  UserRepositoryPort,
} from '../../application/ports/user-repository.port';

@Injectable()
export class UserRepositoryAdapter implements UserRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  // Lecture depuis la vue "userMeView" (profil complet)
  async findMyProfile(userId: string): Promise<UserProfileSnapshot | null> {
    const results = await this.drizzle.db
      .select()
      .from(userMeView)
      .where(eq(userMeView.id, userId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    // Mapping de la ligne SQL vers le snapshot
    const row = results[0];
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      bio: row.bio ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // Lecture depuis la vue "userPublicView" (infos publiques uniquement)
  async findPublicProfile(
    userId: string,
  ): Promise<PublicUserProfileSnapshot | null> {
    const results = await this.drizzle.db
      .select()
      .from(userPublicView)
      .where(eq(userPublicView.id, userId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    return {
      id: row.id,
      displayName: row.displayName,
      bio: row.bio ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
