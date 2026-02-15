// Query CQRS : liste les conversations de l'utilisateur connecte
// Retourne les conversations avec le dernier message et le nombre de membres
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ConversationWithLastMessage } from '../../domain/models';
import { ConversationRepositoryPort } from '../ports/conversation-repository.port';

export class ListMyConversationsQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(ListMyConversationsQuery)
export class ListMyConversationsQueryHandler implements IQueryHandler<
  ListMyConversationsQuery,
  ConversationWithLastMessage[]
> {
  constructor(private readonly conversationRepo: ConversationRepositoryPort) {}

  async execute(
    query: ListMyConversationsQuery,
  ): Promise<ConversationWithLastMessage[]> {
    return this.conversationRepo.findByUserId(query.userId);
  }
}
