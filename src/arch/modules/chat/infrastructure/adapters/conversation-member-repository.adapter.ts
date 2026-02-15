// Adapter Drizzle pour ConversationMemberRepositoryPort
import { DrizzleService } from '@common/db/drizzle.service';
import { conversationMembers } from '@common/db/schema';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ConversationMemberRepositoryPort } from '../../application/ports/conversation-member-repository.port';
import { ConversationMember } from '../../domain/models';

@Injectable()
export class ConversationMemberRepositoryAdapter implements ConversationMemberRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async addMember(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMember> {
    const now = new Date();
    await this.drizzle.db.insert(conversationMembers).values({
      conversationId,
      userId,
      joinedAt: now,
    });
    return { conversationId, userId, joinedAt: now };
  }

  // Ajoute plusieurs membres en un seul INSERT (batch)
  async addMembers(conversationId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const now = new Date();
    await this.drizzle.db.insert(conversationMembers).values(
      userIds.map((userId) => ({
        conversationId,
        userId,
        joinedAt: now,
      })),
    );
  }

  async findMembers(conversationId: string): Promise<ConversationMember[]> {
    const results = await this.drizzle.db
      .select()
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));

    return results.map((r) => ({
      conversationId: r.conversationId,
      userId: r.userId,
      joinedAt: r.joinedAt,
    }));
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const results = await this.drizzle.db
      .select()
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
        ),
      )
      .limit(1);
    return results.length > 0;
  }
}
