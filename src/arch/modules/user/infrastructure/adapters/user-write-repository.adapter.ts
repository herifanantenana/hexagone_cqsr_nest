// Adapter d'ecriture : implemente le port UserWriteRepositoryPort avec Drizzle ORM
// Gere le CRUD sur la table "users" et la conversion vers le modele domaine

import { DrizzleService } from '@common/db/drizzle.service';
import { users } from '@common/db/schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  CreateUserData,
  UserWriteRepositoryPort,
} from '../../application/ports/user-write-repository.port';
import { User } from '../../domain/models/user.model';
import { Email } from '../../domain/value-objects/email.vo';
import { UserStatus } from '../../domain/value-objects/user-status.vo';

@Injectable()
export class UserWriteRepositoryAdapter implements UserWriteRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  // Insere un nouvel utilisateur en base
  async create(data: CreateUserData): Promise<void> {
    await this.drizzle.db.insert(users).values({
      id: data.id,
      email: data.email,
      passwordHash: data.passwordHash,
      displayName: data.displayName,
      status: data.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Persiste les modifications de l'agregat User
  async update(user: User): Promise<void> {
    await this.drizzle.db
      .update(users)
      .set({
        displayName: user.getDisplayName(),
        bio: user.getBio(),
        avatarKey: user.getAvatarKey(),
        avatarUrl: user.getAvatarUrl(),
        passwordHash: user.getPasswordHash(),
        status: user.getStatus().getValue(),
        updatedAt: user.getUpdatedAt(),
      })
      .where(eq(users.id, user.getId()));
  }

  async findById(userId: string): Promise<User | null> {
    const results = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.toDomain(results[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const results = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.toDomain(results[0]);
  }

  // Convertit une ligne SQL en agregat domaine User
  private toDomain(row: typeof users.$inferSelect): User {
    return User.reconstitute({
      id: row.id,
      email: Email.create(row.email),
      passwordHash: row.passwordHash,
      displayName: row.displayName,
      bio: row.bio ?? undefined,
      avatarKey: row.avatarKey ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      status: UserStatus.create(row.status),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
