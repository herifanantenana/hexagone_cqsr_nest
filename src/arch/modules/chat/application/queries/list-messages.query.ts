// Query CQRS : liste les messages d'une conversation avec pagination
// Verifie la membership via policy domaine
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedResult } from '@shared/types/pagination.type';
import { ConversationNotFoundError } from '../../domain/errors';
import { MessageWithSender } from '../../domain/models';
import { MessagePolicyService } from '../../domain/services';
import { ConversationMemberRepositoryPort } from '../ports/conversation-member-repository.port';
import { ConversationRepositoryPort } from '../ports/conversation-repository.port';
import { MessageRepositoryPort } from '../ports/message-repository.port';

export class ListMessagesQuery {
  constructor(
    public readonly userId: string,
    public readonly conversationId: string,
    public readonly page: number = 1,
    public readonly pageSize: number = 50,
  ) {}
}

@QueryHandler(ListMessagesQuery)
export class ListMessagesQueryHandler implements IQueryHandler<
  ListMessagesQuery,
  PaginatedResult<MessageWithSender>
> {
  private readonly messagePolicy = new MessagePolicyService();

  constructor(
    private readonly conversationRepo: ConversationRepositoryPort,
    private readonly memberRepo: ConversationMemberRepositoryPort,
    private readonly messageRepo: MessageRepositoryPort,
  ) {}

  async execute(
    query: ListMessagesQuery,
  ): Promise<PaginatedResult<MessageWithSender>> {
    const { userId, conversationId, page, pageSize } = query;

    // Verifie que la conversation existe
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    // Policy : seuls les membres peuvent lire les messages
    const members = await this.memberRepo.findMembers(conversationId);
    this.messagePolicy.assertCanRead(userId, members);

    // Clamp pageSize entre 1 et 100
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));

    const { data, total } = await this.messageRepo.findByConversationId(
      conversationId,
      safePage,
      safePageSize,
    );

    return {
      data,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }
}
