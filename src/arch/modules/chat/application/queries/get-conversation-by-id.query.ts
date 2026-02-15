// Query CQRS : recupere une conversation par son ID
// Verifie la membership via policy domaine (seuls les membres peuvent voir)
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ConversationNotFoundError } from '../../domain/errors';
import { Conversation, ConversationMember } from '../../domain/models';
import { ConversationPolicyService } from '../../domain/services';
import { ConversationMemberRepositoryPort } from '../ports/conversation-member-repository.port';
import { ConversationRepositoryPort } from '../ports/conversation-repository.port';

export class GetConversationByIdQuery {
  constructor(
    public readonly conversationId: string,
    public readonly userId: string, // Pour verifier la membership
  ) {}
}

export interface ConversationDetailResult {
  conversation: Conversation;
  members: ConversationMember[];
}

@QueryHandler(GetConversationByIdQuery)
export class GetConversationByIdQueryHandler implements IQueryHandler<
  GetConversationByIdQuery,
  ConversationDetailResult
> {
  private readonly policy = new ConversationPolicyService();

  constructor(
    private readonly conversationRepo: ConversationRepositoryPort,
    private readonly memberRepo: ConversationMemberRepositoryPort,
  ) {}

  async execute(
    query: GetConversationByIdQuery,
  ): Promise<ConversationDetailResult> {
    const { conversationId, userId } = query;

    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    const members = await this.memberRepo.findMembers(conversationId);

    // Policy : seuls les membres peuvent voir la conversation
    this.policy.assertIsMember(userId, members);

    return { conversation, members };
  }
}
