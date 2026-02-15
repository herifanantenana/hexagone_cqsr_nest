// Adapter Drizzle pour MessageRepositoryPort
import { DrizzleService } from '@common/db/drizzle.service';
import { messages, users } from '@common/db/schema';
import { Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { MessageRepositoryPort } from '../../application/ports/message-repository.port';
import { CreateMessageData, MessageWithSender } from '../../domain/models';

@Injectable()
export class MessageRepositoryAdapter implements MessageRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(data: CreateMessageData): Promise<MessageWithSender> {
    const now = new Date();
    await this.drizzle.db.insert(messages).values({
      id: data.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      createdAt: now,
    });

    // Fetch sender displayName for a consistent response format
    const [sender] = await this.drizzle.db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, data.senderId))
      .limit(1);

    return {
      id: data.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      senderDisplayName: sender?.displayName ?? '',
      content: data.content,
      createdAt: now,
    };
  }

  // Pagination avec join sur users pour le displayName de l'expediteur
  async findByConversationId(
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: MessageWithSender[]; total: number }> {
    const offset = (page - 1) * pageSize;

    // Compte total pour la pagination
    const countResult = await this.drizzle.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    const total = countResult[0]?.count || 0;

    // Recupere les messages avec le displayName du sender
    const results = await this.drizzle.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        senderDisplayName: users.displayName,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data: results.map((r) => ({
        id: r.id,
        conversationId: r.conversationId,
        senderId: r.senderId,
        senderDisplayName: r.senderDisplayName,
        content: r.content,
        createdAt: r.createdAt,
      })),
      total,
    };
  }
}
