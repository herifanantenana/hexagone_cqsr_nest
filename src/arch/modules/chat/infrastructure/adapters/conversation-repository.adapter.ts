// Adapter Drizzle pour ConversationRepositoryPort
// Implemente la persistence des conversations via Drizzle ORM
import { DrizzleService } from '@common/db/drizzle.service';
import {
  conversationMembers,
  conversations,
  messages,
} from '@common/db/schema';
import { Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { ConversationRepositoryPort } from '../../application/ports/conversation-repository.port';
import {
  Conversation,
  ConversationWithLastMessage,
  CreateConversationData,
} from '../../domain/models';

@Injectable()
export class ConversationRepositoryAdapter implements ConversationRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(data: CreateConversationData): Promise<Conversation> {
    const now = new Date();
    await this.drizzle.db.insert(conversations).values({
      id: data.id,
      createdBy: data.createdBy,
      title: data.title || null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: data.id,
      createdBy: data.createdBy,
      title: data.title || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async findById(id: string): Promise<Conversation | null> {
    const results = await this.drizzle.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (results.length === 0) return null;
    return this.toDomain(results[0]);
  }

  // Requete optimisee : liste les conversations d'un user avec le dernier message
  // Utilise des sous-requetes pour le comptage de membres et le dernier message
  async findByUserId(userId: string): Promise<ConversationWithLastMessage[]> {
    // Sous-requete : dernier message par conversation
    const lastMessageSubquery = this.drizzle.db
      .select({
        conversationId: messages.conversationId,
        content: sql<string>`(
          SELECT content FROM messages m2
          WHERE m2.conversation_id = ${messages.conversationId}
          ORDER BY m2.created_at DESC LIMIT 1
        )`.as('last_content'),
        lastAt: sql<Date>`MAX(${messages.createdAt})`.as('last_at'),
      })
      .from(messages)
      .groupBy(messages.conversationId)
      .as('last_msg');

    // Sous-requete : nombre de membres par conversation
    const memberCountSubquery = this.drizzle.db
      .select({
        conversationId: conversationMembers.conversationId,
        count: sql<number>`COUNT(*)::int`.as('member_count'),
      })
      .from(conversationMembers)
      .groupBy(conversationMembers.conversationId)
      .as('member_cnt');

    const results = await this.drizzle.db
      .select({
        id: conversations.id,
        createdBy: conversations.createdBy,
        title: conversations.title,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        lastMessageContent: lastMessageSubquery.content,
        lastMessageAt: lastMessageSubquery.lastAt,
        memberCount: memberCountSubquery.count,
      })
      .from(conversationMembers)
      .innerJoin(
        conversations,
        eq(conversationMembers.conversationId, conversations.id),
      )
      .leftJoin(
        lastMessageSubquery,
        eq(conversations.id, lastMessageSubquery.conversationId),
      )
      .leftJoin(
        memberCountSubquery,
        eq(conversations.id, memberCountSubquery.conversationId),
      )
      .where(eq(conversationMembers.userId, userId))
      .orderBy(desc(conversations.updatedAt));

    return results.map((r) => ({
      id: r.id,
      createdBy: r.createdBy,
      title: r.title,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      lastMessageContent: r.lastMessageContent || null,
      lastMessageAt: r.lastMessageAt || null,
      memberCount: r.memberCount || 0,
    }));
  }

  private toDomain(row: typeof conversations.$inferSelect): Conversation {
    return {
      id: row.id,
      createdBy: row.createdBy,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
