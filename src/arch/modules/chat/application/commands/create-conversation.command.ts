// Commande CQRS : creation d'une conversation avec des membres initiaux
// Le createur est automatiquement ajoute comme membre
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IdGenerator } from '@shared/utils/id-generator.util';
import { Conversation } from '../../domain/models';
import { ConversationMemberRepositoryPort } from '../ports/conversation-member-repository.port';
import { ConversationRepositoryPort } from '../ports/conversation-repository.port';

export class CreateConversationCommand {
  constructor(
    public readonly creatorId: string,
    public readonly memberIds: string[], // Autres membres (le createur est ajoute auto)
    public readonly title?: string,
  ) {}
}

export interface CreateConversationResult {
  id: string;
  createdBy: string;
  title: string | null;
  createdAt: Date;
  members: string[];
}

@CommandHandler(CreateConversationCommand)
export class CreateConversationCommandHandler implements ICommandHandler<
  CreateConversationCommand,
  CreateConversationResult
> {
  constructor(
    private readonly conversationRepo: ConversationRepositoryPort,
    private readonly memberRepo: ConversationMemberRepositoryPort,
  ) {}

  async execute(
    command: CreateConversationCommand,
  ): Promise<CreateConversationResult> {
    const { creatorId, memberIds, title } = command;
    const conversationId = IdGenerator.generate();

    // Cree la conversation
    const conversation: Conversation = await this.conversationRepo.create({
      id: conversationId,
      createdBy: creatorId,
      title,
    });

    // Ajoute le createur + les membres fournis (dedupliques)
    const uniqueMemberIds = [...new Set([creatorId, ...memberIds])];
    await this.memberRepo.addMembers(conversationId, uniqueMemberIds);

    return {
      id: conversation.id,
      createdBy: conversation.createdBy,
      title: conversation.title,
      createdAt: conversation.createdAt,
      members: uniqueMemberIds,
    };
  }
}
