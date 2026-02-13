import { DrizzleService } from '@common/db/drizzle.service';
import { sessions } from '@common/db/schema';
import { IdGenerator } from '@shared/utils/id-generator.util';
import { Injectable } from '@nestjs/common';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { SessionRepositoryPort } from '../../application/ports/session-repository.port';
import { CreateSessionData, Session } from '../../domain/models';

@Injectable()
export class SessionRepositoryAdapter implements SessionRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(data: CreateSessionData): Promise<Session> {
    const sessionId = IdGenerator.generate();
    const now = new Date();

    await this.drizzle.db.insert(sessions).values({
      id: sessionId,
      userId: data.userId,
      refreshTokenHash: data.refreshTokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      userAgent: data.userAgent,
      ip: data.ip,
      createdAt: now,
    });

    return {
      id: sessionId,
      userId: data.userId,
      refreshTokenHash: data.refreshTokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      userAgent: data.userAgent,
      ip: data.ip,
      createdAt: now,
    };
  }

  async findById(sessionId: string): Promise<Session | null> {
    const results = await this.drizzle.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.toDomain(results[0]);
  }

  async findByRefreshTokenHash(hash: string): Promise<Session | null> {
    const results = await this.drizzle.db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, hash))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.toDomain(results[0]);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.drizzle.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.drizzle.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.drizzle.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date()));
  }

  private toDomain(row: typeof sessions.$inferSelect): Session {
    return {
      id: row.id,
      userId: row.userId,
      refreshTokenHash: row.refreshTokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt ?? null,
      userAgent: row.userAgent ?? undefined,
      ip: row.ip ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
